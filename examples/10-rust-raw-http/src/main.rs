use std::{
    collections::BTreeMap,
    env,
    error::Error,
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::{SecondsFormat, Utc};
use reqwest::{header::HeaderMap, StatusCode};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tokio::time::sleep;

const EXAMPLE_NAME: &str = "10-rust-raw-http";

type DynError = Box<dyn Error + Send + Sync>;

#[tokio::main]
async fn main() -> Result<(), DynError> {
    let run_id = env_value(
        "FIRELINE_RUST_RAW_RUN_ID",
        &format!("{}-{}", utc_compact(), std::process::id()),
    );
    let control_stream = env_value("FIRELINE_CONTROL_STREAM", "fireline-rust-raw-control");
    let stream_url = derive_stream_url(&control_stream);
    let launch_id = env_value("FIRELINE_RUST_RAW_LAUNCH_ID", &format!("rust-raw-{run_id}"));
    let client_request_id = env_value(
        "FIRELINE_RUST_RAW_CLIENT_REQUEST_ID",
        &format!("launch:rust-raw:{run_id}"),
    );
    let state_stream = env_value(
        "FIRELINE_RUST_RAW_STATE_STREAM",
        &format!("rust-raw-session-{run_id}"),
    );
    let requested_by = env_value(
        "FIRELINE_RUST_RAW_REQUESTED_BY",
        &format!("examples/{EXAMPLE_NAME}"),
    );
    let prompt = env_value(
        "FIRELINE_RUST_RAW_PROMPT",
        "ping from Rust raw Durable Streams HTTP",
    );
    let timeout_ms = positive_int_env("FIRELINE_RUST_RAW_WAIT_TIMEOUT_MS", 60_000)?;

    let output_root = PathBuf::from(env_value(
        "FIRELINE_EXAMPLE_OUTPUT_ROOT",
        &format!(
            "{}/fireline-examples",
            env::var("TMPDIR")
                .unwrap_or_else(|_| "/tmp".to_string())
                .trim_end_matches('/')
        ),
    ));
    let work_dir = output_root.join(EXAMPLE_NAME).join(&run_id);
    fs::create_dir_all(&work_dir)?;

    let launch_envelope = launch_request_envelope(
        &launch_id,
        &client_request_id,
        &state_stream,
        &requested_by,
        &prompt,
        timeout_ms,
    )?;
    let launch_path = write_json(&work_dir.join("launch-request.json"), &launch_envelope)?;

    let client = reqwest::Client::new();
    let launch_headers = append_json(&client, &stream_url, &launch_envelope).await?;
    let launch_row =
        wait_for_launch_row(&client, &stream_url, &launch_id, "session", timeout_ms).await?;
    let observed_launch_path = write_json(&work_dir.join("observed-launch.json"), &launch_row)?;

    let stop_envelope = launch_stop_envelope(&launch_id, &client_request_id, &requested_by);
    let stop_path = write_json(&work_dir.join("launch-stop.json"), &stop_envelope)?;
    let stop_headers = append_json(&client, &stream_url, &stop_envelope).await?;
    let stopped_row =
        wait_for_launch_row(&client, &stream_url, &launch_id, "stopped", timeout_ms).await?;
    let observed_stop_path = write_json(&work_dir.join("observed-stop.json"), &stopped_row)?;

    let summary = json!({
        "example": EXAMPLE_NAME,
        "streamUrl": stream_url,
        "launchId": launch_id,
        "clientRequestId": client_request_id,
        "stateStream": state_stream,
        "launchAppendNextOffset": header_value(&launch_headers, "Stream-Next-Offset"),
        "stopAppendNextOffset": header_value(&stop_headers, "Stream-Next-Offset"),
        "status": stopped_row.get("status").cloned().unwrap_or(Value::Null),
        "runtime": stopped_row.get("runtime").cloned().unwrap_or(Value::Null),
        "artifacts": {
            "workDir": work_dir,
            "launchRequest": launch_path,
            "observedLaunch": observed_launch_path,
            "launchStop": stop_path,
            "observedStop": observed_stop_path,
        },
    });
    println!("{}", serde_json::to_string_pretty(&summary)?);

    Ok(())
}

fn derive_stream_url(control_stream: &str) -> String {
    if let Ok(exact) = env::var("FIRELINE_LAUNCH_CONTROL_STREAM_URL") {
        if !exact.is_empty() {
            return exact;
        }
    }

    if let Ok(base) = env::var("FIRELINE_DURABLE_STREAMS_URL") {
        if !base.is_empty() {
            return format!("{}/{}", base.trim_end_matches('/'), control_stream);
        }
    }

    let streams_port = env_value("FIRELINE_STREAMS_PORT", "7474");
    format!("http://127.0.0.1:{streams_port}/v1/stream/{control_stream}")
}

fn launch_request_envelope(
    launch_id: &str,
    client_request_id: &str,
    state_stream: &str,
    requested_by: &str,
    prompt: &str,
    timeout_ms: u64,
) -> Result<Value, DynError> {
    let artifact = inline_bundle_artifact(
        "agent.mjs",
        vec![InlineFile {
            path: "agent.mjs",
            media_type: "text/javascript",
            content: agent_source(),
        }],
        json!({
            "producer": "fireline-examples",
            "source": format!("examples/{EXAMPLE_NAME}"),
            "revision": launch_id,
        }),
    )?;

    Ok(json!({
        "type": "fireline.launch_request",
        "key": format!("launch:{launch_id}"),
        "headers": { "operation": "insert" },
        "value": {
            "launchId": launch_id,
            "clientRequestId": client_request_id,
            "idempotencyKey": client_request_id,
            "target": {
                "kind": "inlineConductorSpec",
                "spec": {
                    "__fireline_brand": "conductor_spec",
                    "name": "rust-raw-http",
                    "sandboxes": {
                        "default": {
                            "provider": "local",
                            "fsBackend": "local",
                            "labels": {
                                "example": EXAMPLE_NAME,
                                "mode": "raw-http",
                            },
                        },
                    },
                    "middleware": {
                        "__fireline_brand": "middleware_chain",
                        "kind": "middleware",
                        "chain": [],
                    },
                    "agent": {
                        "__fireline_brand": "agent_config",
                        "kind": "agent",
                        "command": [],
                        "form": {
                            "__fireline_brand": "agent_form_spec",
                            "kind": "jsModule",
                            "artifact": artifact,
                        },
                    },
                },
            },
            "startSession": {
                "stateStream": state_stream,
                "create": true,
                "prompt": [{ "type": "text", "text": prompt }],
                "newSession": {
                    "cwd": env::current_dir()?.display().to_string(),
                    "mcpServers": [],
                },
            },
            "runtime": {
                "name": "rust-raw-http",
                "provider": "local",
                "labels": { "example": EXAMPLE_NAME, "mode": "raw-http" },
            },
            "wait": { "until": "session", "timeoutMs": timeout_ms },
            "requestedAt": now_iso(),
            "requestedBy": requested_by,
        },
    }))
}

fn launch_stop_envelope(launch_id: &str, client_request_id: &str, requested_by: &str) -> Value {
    let stop_id = env_value(
        "FIRELINE_RUST_RAW_STOP_ID",
        &format!("stop-{}", now_millis()),
    );
    json!({
        "type": "fireline.launch_stop",
        "key": format!("launch:{launch_id}/stop:{stop_id}"),
        "headers": { "operation": "insert" },
        "value": {
            "launchId": launch_id,
            "stopId": stop_id,
            "requestedAt": now_iso(),
            "requestedBy": requested_by,
            "clientRequestId": client_request_id,
            "reason": env_value("FIRELINE_RUST_RAW_STOP_REASON", "Rust raw HTTP example complete"),
        },
    })
}

async fn append_json(
    client: &reqwest::Client,
    stream_url: &str,
    envelope: &Value,
) -> Result<HeaderMap, DynError> {
    let response = client
        .post(stream_url)
        .header("Content-Type", "application/json")
        .body(serde_json::to_vec(envelope)?)
        .send()
        .await?;
    let status = response.status();
    let headers = response.headers().clone();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(message_error(format!(
            "POST {stream_url} failed with {status}: {body}"
        )));
    }
    Ok(headers)
}

async fn wait_for_launch_row(
    client: &reqwest::Client,
    stream_url: &str,
    launch_id: &str,
    until: &str,
    timeout_ms: u64,
) -> Result<Value, DynError> {
    let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
    while tokio::time::Instant::now() < deadline {
        let rows = read_launch_rows(client, stream_url).await?;
        let row = rows
            .into_iter()
            .filter(|row| row.get("launchId").and_then(Value::as_str) == Some(launch_id))
            .last();
        if let Some(row) = row {
            if row.get("status").and_then(Value::as_str) == Some("failed") {
                let message = row
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
                    .unwrap_or("launch failed");
                return Err(message_error(format!(
                    "Launch {launch_id} failed: {message}"
                )));
            }
            if launch_matches(&row, until) {
                return Ok(row);
            }
        }
        sleep(Duration::from_millis(250)).await;
    }
    Err(message_error(format!(
        "Timed out waiting for {launch_id} to reach {until}"
    )))
}

async fn read_launch_rows(
    client: &reqwest::Client,
    stream_url: &str,
) -> Result<Vec<Value>, DynError> {
    let response = client.get(stream_url).send().await?;
    if response.status() == StatusCode::NOT_FOUND {
        return Ok(Vec::new());
    }
    let status = response.status();
    let text = response.text().await?;
    if !status.is_success() {
        return Err(message_error(format!(
            "GET {stream_url} failed with {status}: {text}"
        )));
    }

    let mut rows = Vec::new();
    for event in expand_stream_values(&parse_stream_values(&text)?)? {
        if event.get("type").and_then(Value::as_str) == Some("fireline.launch") {
            if let Some(value) = event.get("value") {
                rows.push(value.clone());
            }
        }
    }
    Ok(rows)
}

fn parse_stream_values(text: &str) -> Result<Vec<Value>, DynError> {
    let stripped = text.trim();
    if stripped.is_empty() {
        return Ok(Vec::new());
    }
    if let Ok(value) = serde_json::from_str::<Value>(stripped) {
        return Ok(vec![value]);
    }

    let stream = serde_json::Deserializer::from_str(stripped).into_iter::<Value>();
    let mut values = Vec::new();
    for value in stream {
        values.push(value?);
    }
    if values.is_empty() {
        return Err(message_error(
            "Durable stream response was not parseable JSON",
        ));
    }
    Ok(values)
}

fn expand_stream_values(values: &[Value]) -> Result<Vec<Value>, DynError> {
    let mut expanded = Vec::new();
    for value in values {
        expand_stream_value(value, &mut expanded)?;
    }
    Ok(expanded)
}

fn expand_stream_value(value: &Value, expanded: &mut Vec<Value>) -> Result<(), DynError> {
    match value {
        Value::Array(values) => {
            for nested in values {
                expand_stream_value(nested, expanded)?;
            }
        }
        Value::Object(map) => {
            if map.contains_key("type") && map.contains_key("value") {
                expanded.push(value.clone());
                return Ok(());
            }
            for key in ["events", "entries", "items", "chunks", "data"] {
                if let Some(nested) = map.get(key) {
                    if let Some(text) = nested.as_str() {
                        for parsed in parse_stream_values(text)? {
                            expand_stream_value(&parsed, expanded)?;
                        }
                    } else {
                        expand_stream_value(nested, expanded)?;
                    }
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn launch_matches(row: &Value, until: &str) -> bool {
    let status = row.get("status").and_then(Value::as_str);
    match until {
        "observed" => true,
        "runtime" => {
            row.get("runtime").is_some()
                || matches!(
                    status,
                    Some("running" | "session_ready" | "stopping" | "stopped")
                )
        }
        "session" => {
            row.get("startSession").is_some() || matches!(status, Some("session_ready" | "stopped"))
        }
        "stopped" => status == Some("stopped"),
        _ => false,
    }
}

struct InlineFile {
    path: &'static str,
    media_type: &'static str,
    content: String,
}

fn inline_bundle_artifact(
    entrypoint: &str,
    files: Vec<InlineFile>,
    provenance: Value,
) -> Result<Value, DynError> {
    let mut normalized_files = files
        .into_iter()
        .map(inline_bundle_file)
        .collect::<Result<Vec<_>, _>>()?;
    normalized_files.sort_by(|left, right| {
        left.get("path")
            .and_then(Value::as_str)
            .cmp(&right.get("path").and_then(Value::as_str))
    });

    let normalized_entrypoint = normalize_artifact_path(entrypoint)?;
    let created_at = now_iso();
    let producer = provenance
        .get("producer")
        .and_then(Value::as_str)
        .ok_or_else(|| message_error("inline bundle provenance producer is required"))?;
    let source = provenance.get("source").cloned().unwrap_or(Value::Null);
    let revision = provenance.get("revision").cloned().unwrap_or(Value::Null);

    let integrity_input = json!({
        "kind": "inlineBundle",
        "entrypoint": normalized_entrypoint,
        "files": normalized_files.iter().map(|file| json!({
            "path": file.get("path").cloned().unwrap_or(Value::Null),
            "mediaType": file.get("mediaType").cloned().unwrap_or(Value::Null),
            "sha256": file.get("sha256").cloned().unwrap_or(Value::Null),
        })).collect::<Vec<_>>(),
        "provenance": {
            "producer": producer,
            "source": source.clone(),
            "revision": revision.clone(),
        },
    });

    Ok(json!({
        "kind": "inlineBundle",
        "entrypoint": normalized_entrypoint,
        "files": normalized_files,
        "provenance": {
            "producer": producer,
            "createdAt": created_at,
            "source": source,
            "revision": revision,
        },
        "integrity": format!("sha256:{}", sha256_hex(stable_json(&integrity_input)?.as_bytes())),
    }))
}

fn inline_bundle_file(file: InlineFile) -> Result<Value, DynError> {
    let path = normalize_artifact_path(file.path)?;
    let media_type = match file.media_type {
        "application/javascript" => "text/javascript",
        "text/javascript" => "text/javascript",
        other => {
            return Err(message_error(format!(
                "unsupported inline bundle media type: {other}"
            )))
        }
    };
    let content = file.content.as_bytes();
    Ok(json!({
        "path": path,
        "contentBase64": BASE64.encode(content),
        "mediaType": media_type,
        "sha256": sha256_hex(content),
    }))
}

fn normalize_artifact_path(value: &str) -> Result<String, DynError> {
    if value.is_empty()
        || value.starts_with('/')
        || value.contains('\\')
        || value
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(message_error(format!(
            "invalid inline bundle path: {value}"
        )));
    }
    Ok(value.to_string())
}

fn stable_json(value: &Value) -> Result<String, DynError> {
    Ok(match value {
        Value::Array(values) => {
            let items = values
                .iter()
                .map(stable_json)
                .collect::<Result<Vec<_>, _>>()?
                .join(",");
            format!("[{items}]")
        }
        Value::Object(map) => {
            let sorted: BTreeMap<&String, &Value> = map.iter().collect();
            let mut entries = Vec::new();
            for (key, entry) in sorted {
                if !entry.is_null() {
                    entries.push(format!(
                        "{}:{}",
                        serde_json::to_string(key)?,
                        stable_json(entry)?
                    ));
                }
            }
            format!("{{{}}}", entries.join(","))
        }
        _ => serde_json::to_string(value)?,
    })
}

fn agent_source() -> String {
    r#"export default async function handle(ctx) {
  const promptText = Array.isArray(ctx.prompt)
    ? ctx.prompt.map((block) => block && typeof block.text === "string"
      ? block.text
      : JSON.stringify(block)).join("\n")
    : ""
  await ctx.session.text("Rust raw Durable Streams HTTP launch received: " + promptText)
  await ctx.session.complete()
}
"#
    .to_string()
}

fn write_json(path: &Path, value: &Value) -> Result<PathBuf, DynError> {
    fs::write(path, format!("{}\n", serde_json::to_string_pretty(value)?))?;
    Ok(path.to_path_buf())
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn utc_compact() -> String {
    Utc::now().format("%Y%m%dT%H%M%SZ").to_string()
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn sha256_hex(data: &[u8]) -> String {
    format!("{:x}", Sha256::digest(data))
}

fn env_value(name: &str, fallback: &str) -> String {
    env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn positive_int_env(name: &str, fallback: u64) -> Result<u64, DynError> {
    match env::var(name).ok().filter(|value| !value.is_empty()) {
        Some(raw) => {
            let value = raw.parse::<u64>()?;
            if value == 0 {
                return Err(message_error(format!("{name} must be positive")));
            }
            Ok(value)
        }
        None => Ok(fallback),
    }
}

fn header_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned)
}

fn message_error(message: impl Into<String>) -> DynError {
    std::io::Error::new(std::io::ErrorKind::Other, message.into()).into()
}
