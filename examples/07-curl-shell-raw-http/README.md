# Curl/Shell Raw HTTP

This example writes Fireline launch intent directly to the Durable Streams
launch/control stream with `curl`. It does not import `@fireline/client`.

The flow is:

1. read `FIRELINE_ENDPOINT` from `fireline runtime dev` or explicit config,
   otherwise derive from a durable streams base URL or local
   `FIRELINE_STREAMS_PORT` plus `FIRELINE_CONTROL_STREAM`;
2. build a JSON `fireline.launch_request` envelope with a local inline JS
   module agent bundle;
3. append the request with `curl -X POST`;
4. observe first-class `fireline.launch` rows on the same stream as the
   raw backing rows for `collections.launches`;
5. append `fireline.launch_stop` with `curl -X POST`;
6. observe the stopped `fireline.launch` row.

Run it with the local runtime helper:

```sh
pnpm run smoke:curl-shell-raw-http
```

The script derives these defaults when they are not set:

- `FIRELINE_CONTROL_STREAM=fireline-curl-shell-raw-control`
- `FIRELINE_STREAMS_PORT=7474`
- `FIRELINE_RAW_HTTP_RUN_ID=<utc timestamp>-<pid>`
- `FIRELINE_RAW_HTTP_LAUNCH_ID=raw-http-$FIRELINE_RAW_HTTP_RUN_ID`
- `FIRELINE_RAW_HTTP_CLIENT_REQUEST_ID=launch:raw-http:$FIRELINE_RAW_HTTP_RUN_ID`
- `FIRELINE_RAW_HTTP_STATE_STREAM=raw-http-session-$FIRELINE_RAW_HTTP_RUN_ID`

Generated request, stop, response, and observation files are written under
`${FIRELINE_EXAMPLE_OUTPUT_ROOT:-${TMPDIR:-/tmp}/fireline-examples}` so the
example does not create persistent repo state by default.

To point at a provisioned stream instead, set the exact endpoint:

```sh
FIRELINE_ENDPOINT='https://streams.example.com/v1/stream/app-launch-control' \
  sh examples/07-curl-shell-raw-http/run.sh
```

If a deployment gives only a Durable Streams append base, pass the base and an
explicit stream name:

```sh
FIRELINE_DURABLE_STREAMS_URL='https://streams.example.com/v1/stream' \
FIRELINE_CONTROL_STREAM='app-launch-control' \
  sh examples/07-curl-shell-raw-http/run.sh
```
