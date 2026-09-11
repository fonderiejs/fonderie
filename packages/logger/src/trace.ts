import { randomBytes } from 'node:crypto';

// W3C Trace Context (https://www.w3.org/TR/trace-context/). Dep-free: a request
// carries `traceparent: 00-<trace-id>-<span-id>-<flags>`, so one trace joins up
// across services and can be exported to Jaeger/Tempo/Datadog/Grafana. The
// correlation id from Phase 1 becomes this trace id.

export interface ITraceContext {
	/** 16 bytes / 32 hex — the whole trace. */
	traceId: string;
	/** 8 bytes / 16 hex — this hop's span. */
	spanId: string;
	/** The upstream span we continue from, if any. */
	parentSpanId?: string;
	/** The `sampled` flag (bit 0 of trace-flags). */
	sampled: boolean;
}

const TRACE_ID_RE = /^[0-9a-f]{32}$/;
const SPAN_ID_RE = /^[0-9a-f]{16}$/;

function hex(bytes: number): string {
	return randomBytes(bytes).toString('hex');
}

/** Start a fresh, sampled trace. */
export function newTraceContext(): ITraceContext {
	return { traceId: hex(16), spanId: hex(8), sampled: true };
}

/** A new span id under an existing trace. */
export function newSpanId(): string {
	return hex(8);
}

// Parse an inbound `traceparent`. Strict: only version 00, valid hex ids, and a
// non-zero trace/span id (all-zero ids are invalid per spec). Returns the
// UPSTREAM span so the caller can make it the parent of a fresh server span.
export function parseTraceparent(header: string | null): ITraceContext | null {
	if (!header) return null;
	const parts = header.trim().split('-');
	if (parts.length !== 4) return null;
	const [version, traceId, spanId, flags] = parts as [string, string, string, string];
	if (version !== '00' || !TRACE_ID_RE.test(traceId) || !SPAN_ID_RE.test(spanId)) return null;
	if (traceId === '0'.repeat(32) || spanId === '0'.repeat(16)) return null;
	if (!/^[0-9a-f]{2}$/.test(flags)) return null;
	return { traceId, spanId, sampled: (parseInt(flags, 16) & 0x01) === 0x01 };
}

/** Render a `traceparent` for this span. */
export function formatTraceparent(ctx: ITraceContext): string {
	return `00-${ctx.traceId}-${ctx.spanId}-${ctx.sampled ? '01' : '00'}`;
}

// ── Span export ──────────────────────────────────────────────────────────────

export interface ISpan {
	name: string;
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	/** uint64 nanoseconds as a string (JS numbers can't hold epoch-ns exactly). */
	startUnixNano: string;
	endUnixNano: string;
	/** HTTP status of the request the span represents. */
	status: number;
	attributes: Record<string, string | number | boolean>;
}

// Pluggable span sink — self-hosted by default (Console), never a required dep.
// Exporting telemetry must never break a request: implementations swallow their
// own errors.
export interface ITraceExporter {
	export(span: ISpan): void | Promise<void>;
}

// Milliseconds → OTLP uint64-nanosecond string (append six zeros — exact, no
// float rounding).
export function msToUnixNano(ms: number): string {
	return `${Math.trunc(ms)}000000`;
}

// One JSON span per line to stdout. Self-hosted default: point any log-based
// agent (Datadog, Loki, ELK) at stdout, or read it locally.
export class ConsoleTraceExporter implements ITraceExporter {
	export(span: ISpan): void {
		// eslint-disable-next-line no-console
		console.log(JSON.stringify({ type: 'span', ...span }));
	}
}

export interface IOtlpExporterOptions {
	/** Full OTLP/HTTP traces URL, e.g. http://localhost:4318/v1/traces */
	endpoint: string;
	headers?: Record<string, string>;
	/** resource service.name attribute. */
	serviceName?: string;
}

function otlpValue(value: string | number | boolean): Record<string, unknown> {
	if (typeof value === 'boolean') return { boolValue: value };
	if (typeof value === 'number') {
		return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
	}
	return { stringValue: value };
}

function otlpKv(key: string, value: string | number | boolean): Record<string, unknown> {
	return { key, value: otlpValue(value) };
}

// Dep-free OTLP/HTTP exporter — a plain fetch POST of the OTLP-JSON envelope.
// Works with any OTLP collector (Jaeger, Tempo, Grafana Alloy, the Datadog
// agent's OTLP intake, otel-collector). trace/span ids are hex per OTLP/JSON.
export class OtlpHttpTraceExporter implements ITraceExporter {
	constructor(private opts: IOtlpExporterOptions) {}

	async export(span: ISpan): Promise<void> {
		// OTLP status: 0 UNSET, 1 OK, 2 ERROR.
		const statusCode = span.status >= 400 ? 2 : 1;
		const body = {
			resourceSpans: [
				{
					resource: {
						attributes: [otlpKv('service.name', this.opts.serviceName ?? 'fonderie')],
					},
					scopeSpans: [
						{
							scope: { name: '@fonderie/logger' },
							spans: [
								{
									traceId: span.traceId,
									spanId: span.spanId,
									...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
									name: span.name,
									kind: 2, // SERVER
									startTimeUnixNano: span.startUnixNano,
									endTimeUnixNano: span.endUnixNano,
									attributes: Object.entries(span.attributes).map(([k, v]) => otlpKv(k, v)),
									status: { code: statusCode },
								},
							],
						},
					],
				},
			],
		};
		try {
			await fetch(this.opts.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...(this.opts.headers ?? {}) },
				body: JSON.stringify(body),
			});
		} catch {
			// Telemetry export must never break the request.
		}
	}
}
