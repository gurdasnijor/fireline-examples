#!/usr/bin/env python3
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request
from typing import Any


EXAMPLE_NAME = "09-python-raw-http"


def main() -> None:
    run_id = env("FIRELINE_PYTHON_RAW_RUN_ID", f"{utc_compact()}-{os.getpid()}")
    control_stream = env("FIRELINE_CONTROL_STREAM", "fireline-python-raw-control")
    stream_url = derive_stream_url(control_stream)
    launch_id = env("FIRELINE_PYTHON_RAW_LAUNCH_ID", f"python-raw-{run_id}")
    client_request_id = env(
        "FIRELINE_PYTHON_RAW_CLIENT_REQUEST_ID",
        f"launch:python-raw:{run_id}",
    )
    state_stream = env("FIRELINE_PYTHON_RAW_STATE_STREAM", f"python-raw-session-{run_id}")
    requested_by = env("FIRELINE_PYTHON_RAW_REQUESTED_BY", f"examples/{EXAMPLE_NAME}")
    prompt = env("FIRELINE_PYTHON_RAW_PROMPT", "ping from Python raw Durable Streams HTTP")
    timeout_ms = positive_int_env("FIRELINE_PYTHON_RAW_WAIT_TIMEOUT_MS", 60_000)

    output_root = pathlib.Path(
        env(
            "FIRELINE_EXAMPLE_OUTPUT_ROOT",
            str(pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "fireline-examples"),
        )
    )
    work_dir = output_root / EXAMPLE_NAME / run_id
    work_dir.mkdir(parents=True, exist_ok=True)

    launch_envelope = launch_request_envelope(
        launch_id=launch_id,
        client_request_id=client_request_id,
        state_stream=state_stream,
        requested_by=requested_by,
        prompt=prompt,
        timeout_ms=timeout_ms,
    )
    launch_path = write_json(work_dir / "launch-request.json", launch_envelope)
    launch_headers = append_json(stream_url, launch_envelope)

    launch_row = wait_for_launch_row(
        stream_url=stream_url,
        launch_id=launch_id,
        until="session",
        timeout_ms=timeout_ms,
    )
    observed_launch_path = write_json(work_dir / "observed-launch.json", launch_row)

    stop_envelope = launch_stop_envelope(
        launch_id=launch_id,
        client_request_id=client_request_id,
        requested_by=requested_by,
    )
    stop_path = write_json(work_dir / "launch-stop.json", stop_envelope)
    stop_headers = append_json(stream_url, stop_envelope)

    stopped_row = wait_for_launch_row(
        stream_url=stream_url,
        launch_id=launch_id,
        until="stopped",
        timeout_ms=timeout_ms,
    )
    observed_stop_path = write_json(work_dir / "observed-stop.json", stopped_row)

    print(json.dumps({
        "example": EXAMPLE_NAME,
        "streamUrl": stream_url,
        "launchId": launch_id,
        "clientRequestId": client_request_id,
        "stateStream": state_stream,
        "launchAppendNextOffset": launch_headers.get("Stream-Next-Offset"),
        "stopAppendNextOffset": stop_headers.get("Stream-Next-Offset"),
        "status": stopped_row.get("status"),
        "runtime": stopped_row.get("runtime"),
        "artifacts": {
            "workDir": str(work_dir),
            "launchRequest": str(launch_path),
            "observedLaunch": str(observed_launch_path),
            "launchStop": str(stop_path),
            "observedStop": str(observed_stop_path),
        },
    }, indent=2))


def derive_stream_url(control_stream: str) -> str:
    exact = os.environ.get("FIRELINE_LAUNCH_CONTROL_STREAM_URL")
    if exact:
        return exact

    durable_streams_base = os.environ.get("FIRELINE_DURABLE_STREAMS_URL")
    if durable_streams_base:
        return f"{durable_streams_base.rstrip('/')}/{control_stream}"

    streams_port = env("FIRELINE_STREAMS_PORT", "7474")
    return f"http://127.0.0.1:{streams_port}/v1/stream/{control_stream}"


def launch_request_envelope(
    *,
    launch_id: str,
    client_request_id: str,
    state_stream: str,
    requested_by: str,
    prompt: str,
    timeout_ms: int,
) -> dict[str, Any]:
    artifact = inline_bundle_artifact(
        entrypoint="agent.mjs",
        files=[{
            "path": "agent.mjs",
            "mediaType": "text/javascript",
            "content": agent_source(),
        }],
        provenance={
            "producer": "fireline-examples",
            "source": f"examples/{EXAMPLE_NAME}",
            "revision": launch_id,
        },
    )
    return {
        "type": "fireline.launch_request",
        "key": f"launch:{launch_id}",
        "headers": {"operation": "insert"},
        "value": {
            "launchId": launch_id,
            "clientRequestId": client_request_id,
            "idempotencyKey": client_request_id,
            "target": {
                "kind": "inlineConductorSpec",
                "spec": {
                    "__fireline_brand": "conductor_spec",
                    "name": "python-raw-http",
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
                "create": True,
                "prompt": [{"type": "text", "text": prompt}],
                "newSession": {"cwd": os.getcwd(), "mcpServers": []},
            },
            "runtime": {
                "name": "python-raw-http",
                "provider": "local",
                "labels": {"example": EXAMPLE_NAME, "mode": "raw-http"},
            },
            "wait": {"until": "session", "timeoutMs": timeout_ms},
            "requestedAt": now_iso(),
            "requestedBy": requested_by,
        },
    }


def launch_stop_envelope(
    *,
    launch_id: str,
    client_request_id: str,
    requested_by: str,
) -> dict[str, Any]:
    stop_id = env("FIRELINE_PYTHON_RAW_STOP_ID", f"stop-{int(time.time() * 1000)}")
    return {
        "type": "fireline.launch_stop",
        "key": f"launch:{launch_id}/stop:{stop_id}",
        "headers": {"operation": "insert"},
        "value": {
            "launchId": launch_id,
            "stopId": stop_id,
            "requestedAt": now_iso(),
            "requestedBy": requested_by,
            "clientRequestId": client_request_id,
            "reason": env("FIRELINE_PYTHON_RAW_STOP_REASON", "Python raw HTTP example complete"),
        },
    }


def append_json(stream_url: str, envelope: dict[str, Any]) -> dict[str, str]:
    data = json.dumps(envelope, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        stream_url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        response.read()
        headers = {key: value for key, value in response.headers.items()}
        next_offset = response.headers.get("Stream-Next-Offset")
        if next_offset is not None:
            headers["Stream-Next-Offset"] = next_offset
        return headers


def wait_for_launch_row(
    *,
    stream_url: str,
    launch_id: str,
    until: str,
    timeout_ms: int,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_ms / 1000
    while time.monotonic() < deadline:
        rows = read_launch_rows(stream_url)
        matching = [row for row in rows if row.get("launchId") == launch_id]
        row = matching[-1] if matching else None
        if row:
            if row.get("status") == "failed":
                error = row.get("error") if isinstance(row.get("error"), dict) else {}
                raise RuntimeError(error.get("message") or f"Launch {launch_id} failed")
            if launch_matches(row, until):
                return row
        time.sleep(0.25)
    raise TimeoutError(f"Timed out waiting for {launch_id} to reach {until}")


def read_launch_rows(stream_url: str) -> list[dict[str, Any]]:
    try:
        with urllib.request.urlopen(stream_url, timeout=10) as response:
            data = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return []
        raise

    rows = []
    for event in expand_stream_values(parse_stream_values(data)):
        if isinstance(event, dict) and event.get("type") == "fireline.launch":
            value = event.get("value")
            if isinstance(value, dict):
                rows.append(value)
    return rows


def parse_stream_values(text: str) -> list[Any]:
    stripped = text.strip()
    if not stripped:
        return []
    try:
        return [json.loads(stripped)]
    except json.JSONDecodeError:
        values = []
        decoder = json.JSONDecoder()
        index = 0
        length = len(stripped)
        while index < length:
            while index < length and stripped[index].isspace():
                index += 1
            if index >= length:
                break
            value, next_index = decoder.raw_decode(stripped, index)
            values.append(value)
            index = next_index
        if not values:
            raise RuntimeError("Durable stream response was not parseable JSON")
        return values


def expand_stream_values(values: Any) -> list[Any]:
    if isinstance(values, list):
        expanded = []
        for value in values:
            expanded.extend(expand_stream_values(value))
        return expanded
    if not isinstance(values, dict):
        return []
    if values.get("type") and "value" in values:
        return [values]
    expanded = []
    for key in ("events", "entries", "items", "chunks", "data"):
        nested = values.get(key)
        if isinstance(nested, str):
            expanded.extend(expand_stream_values(parse_stream_values(nested)))
        elif nested is not None:
            expanded.extend(expand_stream_values(nested))
    return expanded


def launch_matches(row: dict[str, Any], until: str) -> bool:
    status = row.get("status")
    if until == "observed":
        return True
    if until == "runtime":
        return bool(row.get("runtime")) or status in {"running", "session_ready", "stopping", "stopped"}
    if until == "session":
        return bool(row.get("startSession")) or status in {"session_ready", "stopped"}
    if until == "stopped":
        return status == "stopped"
    raise ValueError(f"unsupported wait condition: {until}")


def inline_bundle_artifact(
    *,
    entrypoint: str,
    files: list[dict[str, str]],
    provenance: dict[str, str],
) -> dict[str, Any]:
    normalized_files = sorted(
        [inline_bundle_file(file) for file in files],
        key=lambda file: file["path"],
    )
    artifact = {
        "kind": "inlineBundle",
        "entrypoint": normalize_artifact_path(entrypoint),
        "files": normalized_files,
        "provenance": {
            "producer": provenance["producer"],
            "createdAt": now_iso(),
            "source": provenance.get("source"),
            "revision": provenance.get("revision"),
        },
    }
    artifact["integrity"] = "sha256:" + sha256_hex(stable_json({
        "kind": artifact["kind"],
        "entrypoint": artifact["entrypoint"],
        "files": [
            {
                "path": file["path"],
                "mediaType": file["mediaType"],
                "sha256": file["sha256"],
            }
            for file in artifact["files"]
        ],
        "provenance": {
            "producer": artifact["provenance"]["producer"],
            "source": artifact["provenance"].get("source"),
            "revision": artifact["provenance"].get("revision"),
        },
    }).encode("utf-8"))
    return artifact


def inline_bundle_file(file: dict[str, str]) -> dict[str, str]:
    path = normalize_artifact_path(file["path"])
    media_type = file.get("mediaType", "text/javascript")
    if media_type == "application/javascript":
        media_type = "text/javascript"
    if media_type != "text/javascript":
        raise ValueError(f"unsupported inline bundle media type: {media_type}")
    content = file["content"].encode("utf-8")
    return {
        "path": path,
        "contentBase64": base64.b64encode(content).decode("ascii"),
        "mediaType": media_type,
        "sha256": sha256_hex(content),
    }


def normalize_artifact_path(value: str) -> str:
    parts = value.split("/")
    if (
        not value
        or value.startswith("/")
        or "\\" in value
        or any(part in {"", ".", ".."} for part in parts)
    ):
        raise ValueError(f"invalid inline bundle path: {value}")
    return value


def stable_json(value: Any) -> str:
    if isinstance(value, list):
        return "[" + ",".join(stable_json(entry) for entry in value) + "]"
    if isinstance(value, dict):
        entries = []
        for key in sorted(value):
            entry = value[key]
            if entry is not None:
                entries.append(json.dumps(key) + ":" + stable_json(entry))
        return "{" + ",".join(entries) + "}"
    return json.dumps(value)


def agent_source() -> str:
    return """\
export default async function handle(ctx) {
  const promptText = Array.isArray(ctx.prompt)
    ? ctx.prompt.map((block) => block && typeof block.text === "string"
      ? block.text
      : JSON.stringify(block)).join("\\n")
    : ""
  await ctx.session.text("Python raw Durable Streams HTTP launch received: " + promptText)
  await ctx.session.complete()
}
"""


def write_json(path: pathlib.Path, value: Any) -> pathlib.Path:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    return path


def now_iso() -> str:
    return dt.datetime.now(dt.UTC).isoformat().replace("+00:00", "Z")


def utc_compact() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def env(name: str, fallback: str) -> str:
    return os.environ.get(name) or fallback


def positive_int_env(name: str, fallback: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return fallback
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{EXAMPLE_NAME}: {error}", file=sys.stderr)
        raise
