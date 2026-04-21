package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

const exampleName = "15-go-raw-http"

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	runID := envValue("FIRELINE_GO_RAW_RUN_ID", fmt.Sprintf("%s-%d", utcCompact(), os.Getpid()))
	controlStream := envValue("FIRELINE_CONTROL_STREAM", "fireline-go-raw-control")
	streamURL := deriveStreamURL(controlStream)
	launchID := envValue("FIRELINE_GO_RAW_LAUNCH_ID", "go-raw-"+runID)
	clientRequestID := envValue("FIRELINE_GO_RAW_CLIENT_REQUEST_ID", "launch:go-raw:"+runID)
	stateStream := envValue("FIRELINE_GO_RAW_STATE_STREAM", "go-raw-session-"+runID)
	requestedBy := envValue("FIRELINE_GO_RAW_REQUESTED_BY", "examples/"+exampleName)
	prompt := envValue("FIRELINE_GO_RAW_PROMPT", "ping from Go raw Durable Streams HTTP")
	timeoutMs, err := positiveIntEnv("FIRELINE_GO_RAW_WAIT_TIMEOUT_MS", 60000)
	if err != nil {
		return err
	}

	outputRoot := envValue("FIRELINE_EXAMPLE_OUTPUT_ROOT", filepath.Join(os.TempDir(), "fireline-examples"))
	workDir := filepath.Join(outputRoot, exampleName, runID)
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		return err
	}

	launchEnvelope, err := launchRequestEnvelope(launchID, clientRequestID, stateStream, requestedBy, prompt, timeoutMs)
	if err != nil {
		return err
	}
	launchPath, err := writeJSON(filepath.Join(workDir, "launch-request.json"), launchEnvelope)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	launchHeaders, err := appendJSON(client, streamURL, launchEnvelope)
	if err != nil {
		return err
	}

	launchRow, err := waitForLaunchRow(client, streamURL, launchID, "session", time.Duration(timeoutMs)*time.Millisecond)
	if err != nil {
		return err
	}
	observedLaunchPath, err := writeJSON(filepath.Join(workDir, "observed-launch.json"), launchRow)
	if err != nil {
		return err
	}

	stopEnvelope := launchStopEnvelope(launchID, clientRequestID, requestedBy)
	stopPath, err := writeJSON(filepath.Join(workDir, "launch-stop.json"), stopEnvelope)
	if err != nil {
		return err
	}
	stopHeaders, err := appendJSON(client, streamURL, stopEnvelope)
	if err != nil {
		return err
	}

	stoppedRow, err := waitForLaunchRow(client, streamURL, launchID, "stopped", time.Duration(timeoutMs)*time.Millisecond)
	if err != nil {
		return err
	}
	observedStopPath, err := writeJSON(filepath.Join(workDir, "observed-stop.json"), stoppedRow)
	if err != nil {
		return err
	}

	summary := map[string]any{
		"example":                exampleName,
		"streamUrl":              streamURL,
		"launchId":               launchID,
		"clientRequestId":        clientRequestID,
		"stateStream":            stateStream,
		"launchAppendNextOffset": launchHeaders.Get("Stream-Next-Offset"),
		"stopAppendNextOffset":   stopHeaders.Get("Stream-Next-Offset"),
		"status":                 stoppedRow["status"],
		"runtime":                stoppedRow["runtime"],
		"artifacts": map[string]any{
			"workDir":        workDir,
			"launchRequest":  launchPath,
			"observedLaunch": observedLaunchPath,
			"launchStop":     stopPath,
			"observedStop":   observedStopPath,
		},
	}
	return printJSON(summary)
}

func deriveStreamURL(controlStream string) string {
	if endpoint := os.Getenv("FIRELINE_ENDPOINT"); endpoint != "" {
		return endpoint
	}
	if base := os.Getenv("FIRELINE_DURABLE_STREAMS_URL"); base != "" {
		return strings.TrimRight(base, "/") + "/" + controlStream
	}
	streamsPort := envValue("FIRELINE_STREAMS_PORT", "7474")
	return "http://127.0.0.1:" + streamsPort + "/v1/stream/" + controlStream
}

func launchRequestEnvelope(
	launchID string,
	clientRequestID string,
	stateStream string,
	requestedBy string,
	prompt string,
	timeoutMs int64,
) (map[string]any, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	artifact, err := inlineBundleArtifact(
		"agent.mjs",
		[]inlineFile{{
			path:      "agent.mjs",
			mediaType: "text/javascript",
			content:   agentSource(),
		}},
		map[string]any{
			"producer": "fireline-examples",
			"source":   "examples/" + exampleName,
			"revision": launchID,
		},
	)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"type":    "fireline.launch_request",
		"key":     "launch:" + launchID,
		"headers": map[string]any{"operation": "insert"},
		"value": map[string]any{
			"launchId":        launchID,
			"clientRequestId": clientRequestID,
			"idempotencyKey":  clientRequestID,
			"target": map[string]any{
				"kind": "inlineConductorSpec",
				"spec": map[string]any{
					"__fireline_brand": "conductor_spec",
					"name":             "go-raw-http",
					"sandboxes": map[string]any{
						"default": map[string]any{
							"provider":  "local",
							"fsBackend": "local",
							"labels": map[string]any{
								"example": exampleName,
								"mode":    "raw-http",
							},
						},
					},
					"middleware": map[string]any{
						"__fireline_brand": "middleware_chain",
						"kind":             "middleware",
						"chain":            []any{},
					},
					"agent": map[string]any{
						"__fireline_brand": "agent_config",
						"kind":             "agent",
						"command":          []any{},
						"form": map[string]any{
							"__fireline_brand": "agent_form_spec",
							"kind":             "jsModule",
							"artifact":         artifact,
						},
					},
				},
			},
			"startSession": map[string]any{
				"stateStream": stateStream,
				"create":      true,
				"prompt": []any{
					map[string]any{"type": "text", "text": prompt},
				},
				"newSession": map[string]any{
					"cwd":        cwd,
					"mcpServers": []any{},
				},
			},
			"runtime": map[string]any{
				"name":     "go-raw-http",
				"provider": "local",
				"labels": map[string]any{
					"example": exampleName,
					"mode":    "raw-http",
				},
			},
			"wait": map[string]any{
				"until":     "session",
				"timeoutMs": timeoutMs,
			},
			"requestedAt": nowISO(),
			"requestedBy": requestedBy,
		},
	}, nil
}

func launchStopEnvelope(launchID string, clientRequestID string, requestedBy string) map[string]any {
	stopID := envValue("FIRELINE_GO_RAW_STOP_ID", fmt.Sprintf("stop-%d", nowMillis()))
	return map[string]any{
		"type":    "fireline.launch_stop",
		"key":     fmt.Sprintf("launch:%s/stop:%s", launchID, stopID),
		"headers": map[string]any{"operation": "insert"},
		"value": map[string]any{
			"launchId":        launchID,
			"stopId":          stopID,
			"requestedAt":     nowISO(),
			"requestedBy":     requestedBy,
			"clientRequestId": clientRequestID,
			"reason":          envValue("FIRELINE_GO_RAW_STOP_REASON", "Go raw HTTP example complete"),
		},
	}
}

func appendJSON(client *http.Client, streamURL string, envelope map[string]any) (http.Header, error) {
	body, err := json.Marshal(envelope)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequest(http.MethodPost, streamURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("POST %s failed with %s: %s", streamURL, response.Status, string(responseBody))
	}
	return response.Header, nil
}

func waitForLaunchRow(
	client *http.Client,
	streamURL string,
	launchID string,
	until string,
	timeout time.Duration,
) (map[string]any, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		rows, err := readLaunchRows(client, streamURL)
		if err != nil {
			return nil, err
		}
		var row map[string]any
		for _, candidate := range rows {
			if stringValue(candidate["launchId"]) == launchID {
				row = candidate
			}
		}
		if row != nil {
			if stringValue(row["status"]) == "failed" {
				if errorValue, ok := row["error"].(map[string]any); ok && stringValue(errorValue["message"]) != "" {
					return nil, fmt.Errorf("launch %s failed: %s", launchID, stringValue(errorValue["message"]))
				}
				return nil, fmt.Errorf("launch %s failed", launchID)
			}
			if launchMatches(row, until) {
				return row, nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	return nil, fmt.Errorf("timed out waiting for %s to reach %s", launchID, until)
}

func readLaunchRows(client *http.Client, streamURL string) ([]map[string]any, error) {
	response, err := client.Get(streamURL)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	if response.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("GET %s failed with %s: %s", streamURL, response.Status, string(body))
	}
	values, err := parseStreamValues(body)
	if err != nil {
		return nil, err
	}
	events, err := expandStreamValues(values)
	if err != nil {
		return nil, err
	}
	var rows []map[string]any
	for _, event := range events {
		if stringValue(event["type"]) != "fireline.launch" {
			continue
		}
		if value, ok := event["value"].(map[string]any); ok {
			rows = append(rows, value)
		}
	}
	return rows, nil
}

func parseStreamValues(body []byte) ([]any, error) {
	stripped := bytes.TrimSpace(body)
	if len(stripped) == 0 {
		return nil, nil
	}
	var single any
	if err := json.Unmarshal(stripped, &single); err == nil {
		return []any{single}, nil
	}
	decoder := json.NewDecoder(bytes.NewReader(stripped))
	var values []any
	for {
		var value any
		if err := decoder.Decode(&value); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
		values = append(values, value)
	}
	if len(values) == 0 {
		return nil, errors.New("durable stream response was not parseable JSON")
	}
	return values, nil
}

func expandStreamValues(values []any) ([]map[string]any, error) {
	var expanded []map[string]any
	for _, value := range values {
		if err := expandStreamValue(value, &expanded); err != nil {
			return nil, err
		}
	}
	return expanded, nil
}

func expandStreamValue(value any, expanded *[]map[string]any) error {
	switch typed := value.(type) {
	case []any:
		for _, nested := range typed {
			if err := expandStreamValue(nested, expanded); err != nil {
				return err
			}
		}
	case map[string]any:
		if _, hasType := typed["type"]; hasType {
			if _, hasValue := typed["value"]; hasValue {
				*expanded = append(*expanded, typed)
				return nil
			}
		}
		for _, key := range []string{"events", "entries", "items", "chunks", "data"} {
			nested, ok := typed[key]
			if !ok {
				continue
			}
			if text, ok := nested.(string); ok {
				values, err := parseStreamValues([]byte(text))
				if err != nil {
					return err
				}
				for _, parsed := range values {
					if err := expandStreamValue(parsed, expanded); err != nil {
						return err
					}
				}
				continue
			}
			if err := expandStreamValue(nested, expanded); err != nil {
				return err
			}
		}
	}
	return nil
}

func launchMatches(row map[string]any, until string) bool {
	status := stringValue(row["status"])
	switch until {
	case "observed":
		return true
	case "runtime":
		return row["runtime"] != nil || status == "running" || status == "session_ready" || status == "stopping" || status == "stopped"
	case "session":
		return row["startSession"] != nil || status == "session_ready" || status == "stopped"
	case "stopped":
		return status == "stopped"
	default:
		return false
	}
}

type inlineFile struct {
	path      string
	mediaType string
	content   string
}

func inlineBundleArtifact(entrypoint string, files []inlineFile, provenance map[string]any) (map[string]any, error) {
	normalizedEntry, err := normalizeArtifactPath(entrypoint)
	if err != nil {
		return nil, err
	}
	normalizedFiles := make([]map[string]any, 0, len(files))
	for _, file := range files {
		normalized, err := inlineBundleFile(file)
		if err != nil {
			return nil, err
		}
		normalizedFiles = append(normalizedFiles, normalized)
	}
	sort.Slice(normalizedFiles, func(left int, right int) bool {
		return stringValue(normalizedFiles[left]["path"]) < stringValue(normalizedFiles[right]["path"])
	})
	producer := stringValue(provenance["producer"])
	if producer == "" {
		return nil, errors.New("inline bundle provenance producer is required")
	}
	source, sourceOK := provenance["source"]
	if !sourceOK {
		source = nil
	}
	revision, revisionOK := provenance["revision"]
	if !revisionOK {
		revision = nil
	}
	integrityInput := map[string]any{
		"kind":       "inlineBundle",
		"entrypoint": normalizedEntry,
		"files":      integrityFiles(normalizedFiles),
		"provenance": map[string]any{
			"producer": producer,
			"source":   source,
			"revision": revision,
		},
	}
	stable, err := stableJSON(integrityInput)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"kind":       "inlineBundle",
		"entrypoint": normalizedEntry,
		"files":      normalizedFiles,
		"provenance": map[string]any{
			"producer":  producer,
			"createdAt": nowISO(),
			"source":    source,
			"revision":  revision,
		},
		"integrity": "sha256:" + sha256Hex([]byte(stable)),
	}, nil
}

func inlineBundleFile(file inlineFile) (map[string]any, error) {
	path, err := normalizeArtifactPath(file.path)
	if err != nil {
		return nil, err
	}
	mediaType := file.mediaType
	if mediaType == "application/javascript" {
		mediaType = "text/javascript"
	}
	if mediaType != "text/javascript" {
		return nil, fmt.Errorf("unsupported inline bundle media type: %s", file.mediaType)
	}
	content := []byte(file.content)
	return map[string]any{
		"path":          path,
		"contentBase64": base64.StdEncoding.EncodeToString(content),
		"mediaType":     mediaType,
		"sha256":        sha256Hex(content),
	}, nil
}

func normalizeArtifactPath(value string) (string, error) {
	if value == "" || strings.HasPrefix(value, "/") || strings.Contains(value, "\\") {
		return "", fmt.Errorf("invalid inline bundle path: %s", value)
	}
	for _, part := range strings.Split(value, "/") {
		if part == "" || part == "." || part == ".." {
			return "", fmt.Errorf("invalid inline bundle path: %s", value)
		}
	}
	return value, nil
}

func integrityFiles(files []map[string]any) []any {
	values := make([]any, 0, len(files))
	for _, file := range files {
		values = append(values, map[string]any{
			"path":      file["path"],
			"mediaType": file["mediaType"],
			"sha256":    file["sha256"],
		})
	}
	return values
}

func stableJSON(value any) (string, error) {
	switch typed := value.(type) {
	case nil:
		return "null", nil
	case string:
		bytes, err := json.Marshal(typed)
		return string(bytes), err
	case bool:
		if typed {
			return "true", nil
		}
		return "false", nil
	case int:
		return strconv.Itoa(typed), nil
	case int64:
		return strconv.FormatInt(typed, 10), nil
	case float64:
		bytes, err := json.Marshal(typed)
		return string(bytes), err
	case []any:
		items := make([]string, 0, len(typed))
		for _, item := range typed {
			encoded, err := stableJSON(item)
			if err != nil {
				return "", err
			}
			items = append(items, encoded)
		}
		return "[" + strings.Join(items, ",") + "]", nil
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key, entry := range typed {
			if entry != nil {
				keys = append(keys, key)
			}
		}
		sort.Strings(keys)
		entries := make([]string, 0, len(keys))
		for _, key := range keys {
			encodedKey, err := json.Marshal(key)
			if err != nil {
				return "", err
			}
			encodedValue, err := stableJSON(typed[key])
			if err != nil {
				return "", err
			}
			entries = append(entries, string(encodedKey)+":"+encodedValue)
		}
		return "{" + strings.Join(entries, ",") + "}", nil
	default:
		bytes, err := json.Marshal(typed)
		return string(bytes), err
	}
}

func agentSource() string {
	return `export default async function handle(ctx) {
  const promptText = Array.isArray(ctx.prompt)
    ? ctx.prompt.map((block) => block && typeof block.text === "string"
      ? block.text
      : JSON.stringify(block)).join("\n")
    : ""
  await ctx.session.text("Go raw Durable Streams HTTP launch received: " + promptText)
  await ctx.session.complete()
}
`
}

func writeJSON(path string, value any) (string, error) {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return "", err
	}
	data = append(data, '\n')
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func printJSON(value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(data))
	return nil
}

func nowISO() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

func utcCompact() string {
	return time.Now().UTC().Format("20060102T150405Z")
}

func nowMillis() int64 {
	return time.Now().UnixMilli()
}

func sha256Hex(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func envValue(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	return value
}

func positiveIntEnv(name string, fallback int64) (int64, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, err
	}
	if value <= 0 {
		return 0, fmt.Errorf("%s must be positive", name)
	}
	return value, nil
}

func stringValue(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}
