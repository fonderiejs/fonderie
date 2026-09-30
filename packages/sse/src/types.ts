import type { IEventScope, Middleware } from '@fonderie/core';

/** What travels between instances and down a stream: a reference, never a raw payload. */
export interface ISseMessage {
	/** Event id — the SSE `id:` a client echoes as Last-Event-ID. */
	id: string;
	/** Event type (a catalog entry's `type`). */
	type: string;
	/** Who it is about, from the entry's `scope(payload)`. */
	scope: IEventScope;
	/** The entry's `project(payload)` — ids only, never domain data. */
	data: Record<string, unknown>;
	/** ISO time the event happened. */
	at: string;
}

/**
 * Fan-out between instances. The default (in-process) serves one instance and
 * tests; `@fonderie/sse/pg` fans out across instances with Postgres
 * LISTEN/NOTIFY and can also hear a brick's own NOTIFY channels.
 */
export interface IBroadcaster {
	publish(message: ISseMessage): Promise<void> | void;
	subscribe(onMessage: (message: ISseMessage) => void): () => void;
	/** Hear a Postgres NOTIFY channel a brick signals on (catalog `source.notify`). Optional. */
	listen?(channel: string, onPayload: (payload: string) => void): Promise<() => void> | (() => void);
	start?(): Promise<void> | void;
	stop?(): Promise<void> | void;
}

/**
 * The event bus, accepted by SHAPE — `@fonderie/events`' EventBus fits, and
 * sse never imports it (dependency budget, docs/REALTIME-DESIGN.md §3.1).
 */
export interface ISseBus {
	on(
		type: string,
		handler: (payload: unknown, meta: { id: string; emittedAt?: string }) => Promise<void> | void,
		consumer?: string,
	): void;
}

export interface ISseOptions {
	/** Delivers bus-sourced catalog events. Omit to deliver only NOTIFY-sourced ones. */
	bus?: ISseBus;
	/** Default: in-process (one instance). Use PgBroadcaster from '@fonderie/sse/pg' for several. */
	broadcaster?: IBroadcaster;
	/**
	 * Run before the stream, in order — the app's own middleware, e.g.
	 * `[withWorkspace(store)]` so workspace-audience events can be authorized.
	 * SSE imports no auth or workspaces code: it reads ctx.user and
	 * ctx.workspace as the app's chain left them.
	 */
	middlewares?: Middleware[];
	/** Close each stream after this long so the reconnect re-runs auth. Default 15 min. */
	maxLifetimeMs?: number;
	/** Heartbeat comment interval. Default 25 s. */
	heartbeatMs?: number;
	/** Most topic filters one connection may ask for. Default 50. */
	maxTopicsPerConnection?: number;
	/** Most open streams per signed-in user. Default 10. */
	maxConnectionsPerUser?: number;
	/** Route prefix. Default '/sse'. */
	path?: string;
	/**
	 * false: a PRODUCER only — subscribe to the bus and publish to the
	 * broadcaster, but serve no streams and register no routes. Use it on a
	 * serverless API while a long-running host serves the streams: the event
	 * bus creates delivery rows only for subscriptions registered in the
	 * process that PUBLISHES an event, so the API must subscribe too, or the
	 * stream host never receives its events. Default true.
	 */
	streams?: boolean;
}
