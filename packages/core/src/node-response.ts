// Web Response → Node ServerResponse, for core's listen() and the Node
// framework adapters (Express, Koa via its raw res). One place owns the rule:
// a text/event-stream body is STREAMED chunk by chunk (with backpressure, and
// cancelled when the client goes away); every other body keeps the buffered
// path — unchanged behaviour, Content-Length included.
import type { ServerResponse } from 'node:http';

import { isEventStream } from './sse';

/** Status + headers. Set-Cookie is forwarded as a LIST — forEach + setHeader would keep only the last. */
export function writeWebHead(webRes: Response, res: ServerResponse): void {
	res.statusCode = webRes.status;
	const setCookies = webRes.headers.getSetCookie?.() ?? [];
	if (setCookies.length) res.setHeader('Set-Cookie', setCookies);
	webRes.headers.forEach((value, key) => {
		if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
	});
}

export async function writeWebResponse(webRes: Response, res: ServerResponse): Promise<void> {
	writeWebHead(webRes, res);
	if (!webRes.body || !isEventStream(webRes)) {
		// Buffer, not text(): byte-faithful for binary bodies (images, PDFs).
		res.end(Buffer.from(await webRes.arrayBuffer()));
		return;
	}
	await pipeWebBody(webRes.body, res);
}

/** Stream a Web body into a Node response until it ends or the client disconnects. */
export async function pipeWebBody(body: ReadableStream<Uint8Array>, res: ServerResponse): Promise<void> {
	res.flushHeaders();
	const reader = body.getReader();
	const onClose = () => {
		reader.cancel().catch(() => {});
	};
	res.once('close', onClose);
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done || res.destroyed) break;
			if (!res.write(value)) {
				// Backpressure: wait for the socket to drain — or to close.
				await new Promise<void>((resolve) => {
					const go = () => {
						res.off('drain', go);
						res.off('close', go);
						resolve();
					};
					res.once('drain', go);
					res.once('close', go);
				});
			}
		}
	} catch {
		// The stream errored or was cancelled because the client left.
	} finally {
		res.off('close', onClose);
		if (!res.destroyed && !res.writableEnded) res.end();
	}
}

/**
 * A signal that aborts when the client disconnects before the response
 * finished — handed to the Web Request so a handler (e.g. an SSE stream) can
 * clean up. A response that completes normally never aborts it.
 */
export function abortOnDisconnect(res: ServerResponse | undefined): AbortSignal | undefined {
	// Tolerate a missing or response-like object that cannot report a close
	// (test doubles, exotic wrappers): no signal beats a crash in the request path.
	if (!res || typeof (res as { once?: unknown }).once !== 'function') return undefined;
	const controller = new AbortController();
	res.once('close', () => {
		if (!res.writableFinished) controller.abort();
	});
	return controller.signal;
}
