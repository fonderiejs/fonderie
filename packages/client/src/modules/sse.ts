// Server-Sent Events from @fonderie/sse (GET /sse/stream). One shared
// connection per client: every subscribe() adds its topics to that stream
// (reconnecting with the union) instead of opening another — the server also
// caps streams per user. Browser and React Native alike: it needs a fetch whose
// Response.body can be read as a stream (browsers; Expo's `expo/fetch` — the
// default React Native fetch cannot, so pass that one as `sse.fetch`).
//
// Push is ADDITIVE: when the stream is unavailable (no streaming fetch, a
// server without @fonderie/sse, offline) nothing breaks — callers keep their
// local snapshots, and every reconnect re-reads. docs/REALTIME-DESIGN.md §4.7.
import type { TokenStore } from '../token-store';

export type FetchLike = (url: string, init?: {
	method?: string;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}) => Promise<{
	ok: boolean;
	status: number;
	body?: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> } } | null;
}>;

export interface ISseClientEvent {
	/** Event id (from the server's `id:`). */
	id?: string;
	type: string;
	/** The catalog entry's projection — ids and scope, never domain data. */
	data: Record<string, unknown>;
	at?: string;
}

export interface ISseSubscribeOptions {
	/**
	 * The stream (re)connected: events may have been missed while it was down,
	 * so refetch what you show. Also fires on the first connect.
	 */
	onReset?: () => void;
}

/** 'unavailable': no streaming fetch, or the server has no SSE route — keep polling. */
export type SseStatus = 'idle' | 'connecting' | 'open' | 'paused' | 'unavailable';

export interface ISseClientDeps {
	absolute: (path: string) => string;
	tokens: TokenStore;
	getWorkspaceId: () => string | undefined;
	refresh?: (() => Promise<string | undefined>) | undefined;
	fetch?: FetchLike | undefined;
	log?: { warn(message: string): void } | undefined;
}

interface ISubscription {
	topics: string[];
	onEvent: (event: ISseClientEvent) => void;
	onReset?: (() => void) | undefined;
}

const MIN_BACKOFF = 1_000;
const MAX_BACKOFF = 30_000;

/** Same rule as the server: '*', an exact type, or a 'prefix.*' segment prefix. */
function matches(filter: string, type: string): boolean {
	if (filter === '*') return true;
	if (filter.endsWith('.*')) return type.startsWith(filter.slice(0, -1)) && type.length > filter.length - 1;
	return filter === type;
}

export class SseClient {
	private readonly subscriptions = new Set<ISubscription>();
	private readonly statusListeners = new Set<(status: SseStatus) => void>();
	private controller: AbortController | undefined;
	private connectedTopics = '';
	private paused = false;
	private retryMs = MIN_BACKOFF;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private scheduled = false;
	private _status: SseStatus = 'idle';

	constructor(private readonly deps: ISseClientDeps) {}

	get status(): SseStatus {
		return this._status;
	}

	onStatus(listener: (status: SseStatus) => void): () => void {
		this.statusListeners.add(listener);
		return () => {
			this.statusListeners.delete(listener);
		};
	}

	/**
	 * Receive events whose type matches any of `topics` ('*', exact types,
	 * 'prefix.*'). Returns an unsubscribe. Shares one connection with every
	 * other subscription on this client.
	 */
	subscribe(topics: string[], onEvent: (event: ISseClientEvent) => void, options: ISseSubscribeOptions = {}): () => void {
		const sub: ISubscription = { topics: topics.length ? topics : ['*'], onEvent, onReset: options.onReset };
		this.subscriptions.add(sub);
		// Already open on a topic set that covers this one: the new subscriber
		// never saw the connect-time reset, so give it its own.
		if (this._status === 'open' && this.unionTopics() === this.connectedTopics) this.safe(() => sub.onReset?.());
		this.schedule();
		return () => {
			this.subscriptions.delete(sub);
			this.schedule();
		};
	}

	/** Close the stream and stop reconnecting (e.g. the app went to the background). */
	pause(): void {
		this.paused = true;
		this.disconnect();
		this.setStatus('paused');
	}

	/** Reconnect after pause() — the connect-time reset tells subscribers to refetch. */
	resume(): void {
		if (!this.paused) return;
		this.paused = false;
		this.retryMs = MIN_BACKOFF;
		this.setStatus('idle');
		this.schedule();
	}

	/** Recompute the topic union once per tick and reconnect if it changed. */
	private schedule(): void {
		if (this.scheduled) return;
		this.scheduled = true;
		queueMicrotask(() => {
			this.scheduled = false;
			const topics = this.unionTopics();
			if (this.paused || this._status === 'unavailable') return;
			if (!topics) {
				this.disconnect();
				this.setStatus('idle');
				return;
			}
			if (topics === this.connectedTopics && this.controller) return;
			this.disconnect();
			void this.connect(topics);
		});
	}

	private unionTopics(): string {
		const all = new Set<string>();
		for (const s of this.subscriptions) for (const t of s.topics) all.add(t);
		if (all.has('*')) return '*';
		return [...all].sort().join(',');
	}

	private disconnect(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = undefined;
		this.controller?.abort();
		this.controller = undefined;
		this.connectedTopics = '';
	}

	private async connect(topics: string, retriedAuth = false): Promise<void> {
		const fetchImpl = this.deps.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
		if (!fetchImpl) return this.unavailable('no fetch');
		const controller = new AbortController();
		this.controller = controller;
		this.connectedTopics = topics;
		this.setStatus('connecting');
		const headers: Record<string, string> = { accept: 'text/event-stream' };
		const token = this.deps.tokens.get();
		if (token) headers['authorization'] = `Bearer ${token}`;
		const workspaceId = this.deps.getWorkspaceId();
		if (workspaceId) headers['x-workspace-id'] = workspaceId;

		try {
			const res = await fetchImpl(this.deps.absolute(`/sse/stream?topics=${encodeURIComponent(topics)}`), {
				method: 'GET',
				headers,
				signal: controller.signal,
			});
			if (controller.signal.aborted) return;
			if (res.status === 401 && this.deps.refresh && !retriedAuth) {
				const fresh = await this.deps.refresh();
				if (fresh && !controller.signal.aborted) return this.connect(topics, true);
			}
			if (res.status === 404) return this.unavailable('server has no /sse/stream');
			if (!res.ok || !res.body) return this.retry();
			if (typeof res.body.getReader !== 'function') return this.unavailable('fetch cannot stream (pass sse.fetch)');
			await this.read(res.body.getReader(), controller);
		} catch {
			if (controller.signal.aborted) return;
		}
		if (!controller.signal.aborted) this.retry();
	}

	private async read(
		reader: { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> },
		controller: AbortController,
	): Promise<void> {
		const decoder = new TextDecoder();
		let buffer = '';
		controller.signal.addEventListener('abort', () => void reader.cancel().catch(() => {}), { once: true });
		for (;;) {
			const { done, value } = await reader.read();
			if (done || controller.signal.aborted) return;
			buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
			for (let i = buffer.indexOf('\n\n'); i >= 0; i = buffer.indexOf('\n\n')) {
				this.frame(buffer.slice(0, i));
				buffer = buffer.slice(i + 2);
			}
		}
	}

	private frame(raw: string): void {
		let event = 'message';
		let id: string | undefined;
		const data: string[] = [];
		for (const line of raw.split('\n')) {
			if (line.startsWith(':')) continue; // heartbeat comment
			const colon = line.indexOf(':');
			const field = colon < 0 ? line : line.slice(0, colon);
			const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
			if (field === 'event') event = value;
			else if (field === 'data') data.push(value);
			else if (field === 'id') id = value;
			else if (field === 'retry' && /^\d+$/.test(value)) this.retryMs = Math.max(MIN_BACKOFF, Number(value));
		}
		if (event === 'fonderie.stream.reset') {
			this.setStatus('open');
			this.retryMs = MIN_BACKOFF;
			for (const s of this.subscriptions) this.safe(() => s.onReset?.());
			return;
		}
		if (event === 'fonderie.stream.expiring' || event === 'message' || data.length === 0) return;
		let body: { type?: string; data?: Record<string, unknown>; at?: string };
		try {
			body = JSON.parse(data.join('\n'));
		} catch {
			return;
		}
		const out: ISseClientEvent = { type: event, data: body.data ?? {}, ...(id ? { id } : {}), ...(body.at ? { at: body.at } : {}) };
		for (const s of this.subscriptions) {
			if (s.topics.some((t) => matches(t, event))) this.safe(() => s.onEvent(out));
		}
	}

	private retry(): void {
		this.controller = undefined;
		this.connectedTopics = '';
		if (this.paused) return;
		this.setStatus('connecting');
		const delay = this.retryMs + Math.floor(Math.random() * 500);
		this.retryMs = Math.min(MAX_BACKOFF, this.retryMs * 2);
		this.timer = setTimeout(() => {
			this.timer = undefined;
			this.schedule();
		}, delay);
	}

	private unavailable(reason: string): void {
		this.controller = undefined;
		this.connectedTopics = '';
		if (this._status !== 'unavailable') (this.deps.log ?? console).warn(`[fonderie] live updates unavailable (${reason}) — values refresh on the next start`);
		this.setStatus('unavailable');
	}

	private setStatus(status: SseStatus): void {
		if (status === this._status) return;
		this._status = status;
		for (const l of this.statusListeners) this.safe(() => l(status));
	}

	private safe(fn: () => void): void {
		try {
			fn();
		} catch (err) {
			console.error('[fonderie] sse subscriber failed:', (err as Error)?.message);
		}
	}
}
