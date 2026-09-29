// Server-Sent Events (text/event-stream) as a Web Response.
//
//   addRoute('GET', '/stream', requireAuth, (ctx) =>
//     sseResponse(ctx.request.signal, (stream) => {
//       const off = hub.subscribe((e) => stream.send({ id: e.id, event: e.type, data: e }));
//       return off; // runs when the client disconnects or the stream closes
//     }),
//   );
//
// Web streams + TextEncoder only, so it runs anywhere a Response does. The
// adapters (and core's listen) stream a text/event-stream body instead of
// buffering it, and abort ctx.request.signal when the client goes away.
// Design: docs/REALTIME-DESIGN.md.

export interface ISseEvent {
	/** Sent as `id:` — the client echoes the last one as Last-Event-ID on reconnect. */
	id?: string;
	/** Sent as `event:`. Omitted → the client's default "message" event. */
	event?: string;
	/** Strings are sent as-is; anything else is JSON-encoded. */
	data: unknown;
}

export interface ISseStream {
	send(event: ISseEvent): void;
	/** A `: comment` line — ignored by clients, keeps idle proxies from closing. */
	comment(text: string): void;
	/** End the stream from the server side (runs cleanup once). */
	close(): void;
	readonly closed: boolean;
}

export interface ISseOptions {
	/** Interval between heartbeat comments. Default 25 s (below common 30–60 s proxy idle timeouts). */
	heartbeatMs?: number;
	/** Reconnect delay hint sent as `retry:`. Default 3000 ms. */
	retryMs?: number;
	/** Extra response headers. */
	headers?: Record<string, string>;
	/** Close the stream after this long (forces a reconnect that re-runs auth). Default: never. */
	maxLifetimeMs?: number;
}

type Cleanup = void | (() => void) | Promise<void | (() => void)>;

export const SSE_CONTENT_TYPE = 'text/event-stream';

/** True for a response the transports must stream rather than buffer. */
export function isEventStream(response: Response): boolean {
	return (response.headers.get('content-type') ?? '').toLowerCase().startsWith(SSE_CONTENT_TYPE);
}

/** One SSE frame. Multi-line data becomes one `data:` line per line (the spec's framing). */
export function formatSseEvent(event: ISseEvent): string {
	let out = '';
	if (event.id !== undefined) out += `id: ${stripNewlines(event.id)}\n`;
	if (event.event !== undefined) out += `event: ${stripNewlines(event.event)}\n`;
	const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
	for (const line of (data ?? '').split(/\r\n|\r|\n/)) out += `data: ${line}\n`;
	return `${out}\n`;
}

function stripNewlines(value: string): string {
	return value.replace(/[\r\n]/g, ' ');
}

export function sseResponse(
	signal: AbortSignal | undefined,
	onOpen: (stream: ISseStream) => Cleanup,
	options: ISseOptions = {},
): Response {
	const encoder = new TextEncoder();
	const heartbeatMs = options.heartbeatMs ?? 25_000;
	let closed = false;
	let cleanup: (() => void) | undefined;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let lifetime: ReturnType<typeof setTimeout> | undefined;
	let controller!: ReadableStreamDefaultController<Uint8Array>;

	const finish = (closeController: boolean) => {
		if (closed) return;
		closed = true;
		if (heartbeat) clearInterval(heartbeat);
		if (lifetime) clearTimeout(lifetime);
		signal?.removeEventListener('abort', onAbort);
		try {
			cleanup?.();
		} catch (err) {
			console.error('[fonderie] sse cleanup failed:', (err as Error)?.message);
		}
		if (closeController) {
			try {
				controller.close();
			} catch {
				// already closed or errored by the consumer
			}
		}
	};
	const onAbort = () => finish(true);

	const write = (text: string) => {
		if (closed) return;
		try {
			controller.enqueue(encoder.encode(text));
		} catch {
			finish(false);
		}
	};

	const stream: ISseStream = {
		send: (event) => write(formatSseEvent(event)),
		comment: (text) => write(`: ${stripNewlines(text)}\n\n`),
		close: () => finish(true),
		get closed() {
			return closed;
		},
	};

	const body = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;
			if (signal?.aborted) {
				finish(true);
				return;
			}
			signal?.addEventListener('abort', onAbort, { once: true });
			write(`retry: ${options.retryMs ?? 3000}\n\n`);
			if (heartbeatMs > 0) heartbeat = setInterval(() => stream.comment('ping'), heartbeatMs);
			if (options.maxLifetimeMs) lifetime = setTimeout(() => finish(true), options.maxLifetimeMs);
			// onOpen may be async; a throw ends the stream with an error frame
			// (headers are already sent, so there is no status code left to set).
			Promise.resolve()
				.then(() => onOpen(stream))
				.then((c) => {
					if (typeof c !== 'function') return;
					if (closed) c();
					else cleanup = c;
				})
				.catch((err: unknown) => {
					console.error('[fonderie] sse handler failed:', (err as Error)?.message);
					stream.send({ event: 'error', data: { reason: 'STREAM_FAILED' } });
					finish(true);
				});
		},
		cancel() {
			// The consumer (transport) stopped reading: the client went away.
			finish(false);
		},
	});

	return new Response(body, {
		status: 200,
		headers: {
			'content-type': `${SSE_CONTENT_TYPE}; charset=utf-8`,
			'cache-control': 'no-store, no-transform',
			// Tell buffering reverse proxies (nginx) to pass bytes through.
			'x-accel-buffering': 'no',
			...options.headers,
		},
	});
}
