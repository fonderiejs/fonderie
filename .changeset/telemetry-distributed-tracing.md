---
"@fonderie/logger": minor
"@fonderie/client": minor
---

Distributed tracing via W3C Trace Context — the Phase-1 correlation id becomes a
real trace you can send to Jaeger/Tempo/Datadog-APM/Grafana, with **no required
deps**.

- `@fonderie/logger`: the request middleware now continues an inbound
  `traceparent` (the upstream span becomes the parent of a fresh server span) or
  starts a new trace, puts `traceId`/`spanId` on `ctx.meta` and the logs, and
  **echoes `traceparent`**. New dep-free helpers (`parseTraceparent`,
  `formatTraceparent`, `newTraceContext`) and an `ITraceExporter` seam with two
  exporters that need no SDK: `ConsoleTraceExporter` (JSON spans → stdout,
  self-hosted default) and `OtlpHttpTraceExporter` (a plain OTLP/HTTP POST that
  works with any OTLP collector). Wire one via `LoggerModule({ traceExporter })`;
  omit it and the trace context still propagates and shows in the logs.
- `@fonderie/client`: sends `traceparent` on every request (portable random ids
  for RN/Hermes) with `X-Request-ID` unified to the trace id, so
  `FonderieApiError.requestId` is the trace id.

`traceparent` is the standardized header (W3C Trace Context; `X-` prefixes are
deprecated per RFC 6648), so traces interoperate with every OTel-compatible tool.
Trace/span ids are random + pseudonymous — metadata-only, same posture as Phase 1.
