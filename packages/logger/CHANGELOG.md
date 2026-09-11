# @fonderie/logger

## 0.3.0

### Minor Changes

- 3039084: Distributed tracing via W3C Trace Context — the Phase-1 correlation id becomes a
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

## 0.2.0

### Minor Changes

- 9e880d1: Request correlation, end-to-end (telemetry Phase 1). The logger's request
  middleware now honours an inbound `X-Request-ID` (client or load balancer) when
  it's a bounded, safe token, generates one only if absent/unsafe, and **echoes it
  in the response header** — so a single id threads the client call → server logs →
  audit trail and can be quoted in a bug report. `@fonderie/client` sends
  `X-Request-ID` on every request (uuid where available, a portable fallback for
  React Native/Hermes) and surfaces it on `FonderieApiError.requestId`.
  Metadata-only and pseudonymous — no payloads captured; IP-minimization policy and
  retention are separate follow-ups.

## 0.1.2

### Patch Changes

- efd6888: Verify OIDC Trusted Publishing after repo recreation (no functional change).

## 0.1.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.
- Updated dependencies [01a2b72]
  - @fonderie/core@0.1.5

## 0.1.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
