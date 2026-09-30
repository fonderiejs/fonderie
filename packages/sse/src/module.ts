import { randomUUID } from 'node:crypto';

import { HTTP, isValidTopicFilter, matchesTopic, setApiResponse, sseResponse } from '@fonderie/core';
import type {
	IEventCatalogEntryWithModule,
	IFonderieApp,
	IFonderieContext,
	IFonderieModule,
	ISseStream,
} from '@fonderie/core';

import { InProcessBroadcaster } from './broadcaster';
import { Hub, type IConnection } from './hub';
import type { IBroadcaster, ISseMessage, ISseOptions } from './types';

const DEFAULTS = {
	maxLifetimeMs: 15 * 60_000,
	heartbeatMs: 25_000,
	maxTopicsPerConnection: 50,
	maxConnectionsPerUser: 10,
	path: '/sse',
};

/**
 * Delivers catalog events (each brick's `describeEvents()`) to connected
 * clients over Server-Sent Events. docs/REALTIME-DESIGN.md.
 *
 *   GET {path}/stream?topics=a,b.*   the stream ('*' or omitted = everything allowed)
 *   GET {path}/topics                 what this caller may subscribe to
 *
 * Push is additive: a client must never wait on this to render (§4.7).
 */
export class SseModule implements IFonderieModule {
	readonly name = '@fonderie/sse';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';

	private readonly options: typeof DEFAULTS & ISseOptions;
	private readonly broadcaster: IBroadcaster;
	private catalog = new Map<string, IEventCatalogEntryWithModule>();
	private hub = new Hub(this.catalog);
	private readonly cleanups: Array<() => void> = [];

	constructor(options: ISseOptions = {}) {
		this.options = { ...DEFAULTS, ...options };
		this.broadcaster = options.broadcaster ?? new InProcessBroadcaster();
	}

	async install(app: IFonderieApp): Promise<void> {
		for (const entry of app.eventCatalog?.() ?? []) this.catalog.set(entry.type, entry);
		this.hub = new Hub(this.catalog);

		await this.broadcaster.start?.();
		const streams = this.options.streams !== false;
		if (streams) this.cleanups.push(this.broadcaster.subscribe((message) => void this.hub.deliver(message)));

		for (const entry of this.catalog.values()) {
			if (entry.source) {
				// NOTIFY-sourced events are heard where streams are served; a
				// producer-only instance leaves them to the stream host.
				if (!streams) continue;
				if (!this.broadcaster.listen) {
					console.warn(
						`[sse] ${entry.type} is signalled on NOTIFY channel '${entry.source.notify}', ` +
							'which this broadcaster cannot hear — use PgBroadcaster from @fonderie/sse/pg to deliver it.',
					);
					continue;
				}
				const stop = await this.broadcaster.listen(entry.source.notify, (payload) => {
					this.publish(entry, payload, randomUUID(), new Date().toISOString());
				});
				this.cleanups.push(stop);
			} else if (this.options.bus) {
				// One consumer per type: the bus claims per consumer name, and the
				// broadcaster (not the bus) does the fan-out to every host.
				this.options.bus.on(
					entry.type,
					(payload, meta) => this.publish(entry, payload, meta.id, meta.emittedAt ?? new Date().toISOString()),
					`sse:${entry.type}`,
				);
			}
		}

		if (!streams) return; // producer only: no routes, nothing to serve

		if (process.env['NODE_ENV'] === 'production' && this.broadcaster instanceof InProcessBroadcaster) {
			console.warn(
				'[sse] in-process broadcaster: streams only receive events processed by THIS instance. ' +
					'Several instances need PgBroadcaster from @fonderie/sse/pg.',
			);
		}

		const base = this.options.path.replace(/\/$/, '');
		const before = this.options.middlewares ?? [];
		app.addRoute('GET', `${base}/stream`, ...before, (ctx) => this.stream(ctx));
		app.addRoute('GET', `${base}/topics`, ...before, async (ctx) => this.topics(ctx));
	}

	async stop(): Promise<void> {
		while (this.cleanups.length) {
			try {
				this.cleanups.pop()?.();
			} catch {
				// best effort on shutdown
			}
		}
		this.hub.closeAll();
		await this.broadcaster.stop?.();
	}

	/** Entries this caller could ever receive: public ones, plus the rest when signed in. */
	private visible(ctx: IFonderieContext): IEventCatalogEntryWithModule[] {
		return [...this.catalog.values()].filter((e) => e.audience === 'public' || ctx.user !== null);
	}

	private topics(ctx: IFonderieContext): Response {
		const topics = this.visible(ctx).map((e) => ({
			type: e.type,
			description: e.description,
			audience: typeof e.audience === 'function' ? 'custom' : e.audience,
		}));
		return setApiResponse(HTTP.OK, 'REALTIME_TOPICS', 'Topics you may subscribe to.', { topics });
	}

	private async stream(ctx: IFonderieContext): Promise<Response> {
		// Credentials the app's auth chain could not verify — expired, or signed
		// with a rotated secret — must not quietly become an anonymous stream:
		// it would get only public events, and the client would never learn its
		// token is bad. A 401 lets the client refresh once and reconnect as the
		// user (or sign out). No credentials at all is a legitimate anonymous stream.
		if (!ctx.user && /^bearer\s+\S/i.test(ctx.request.headers.get('authorization') ?? '')) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'The session is invalid or expired — refresh it and reconnect.');
		}
		const raw = new URL(ctx.request.url).searchParams.get('topics') ?? '*';
		const filters = [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))];
		if (filters.length === 0) filters.push('*');
		if (filters.length > this.options.maxTopicsPerConnection) {
			return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', `At most ${this.options.maxTopicsPerConnection} topics per stream.`);
		}
		const visible = this.visible(ctx);
		for (const filter of filters) {
			if (!isValidTopicFilter(filter)) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', `Invalid topic '${filter}': use '*', an event type, or 'prefix.*'.`);
			}
			if (!visible.some((e) => matchesTopic(filter, e.type))) {
				// Either unknown, or not visible to an anonymous caller.
				const known = [...this.catalog.values()].some((e) => matchesTopic(filter, e.type));
				return known && !ctx.user
					? setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', `Topic '${filter}' requires a signed-in user.`)
					: setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', `Unknown topic '${filter}'.`, {
							topics: visible.map((e) => e.type),
						});
			}
		}
		if (ctx.user && this.hub.countForUser(ctx.user.id) >= this.options.maxConnectionsPerUser) {
			return setApiResponse(HTTP.TOO_MANY_REQUESTS, 'TOO_MANY_STREAMS', `At most ${this.options.maxConnectionsPerUser} open streams per user.`);
		}

		const lifetime = this.options.maxLifetimeMs;
		return sseResponse(
			ctx.request.signal,
			(stream: ISseStream) => {
				// v1 has no replay: every (re)connect starts with a reset, and the
				// client refetches what it shows (payloads are invalidations).
				stream.send({ event: 'fonderie.stream.reset', data: { reason: 'CONNECTED' } });
				const connection: IConnection = { topics: filters, ctx, stream };
				this.hub.add(connection);
				// Warn shortly before the lifetime closes the stream, so a client can
				// refresh its token and reconnect without surprise.
				const warn =
					lifetime > 5_000
						? setTimeout(() => stream.send({ event: 'fonderie.stream.expiring', data: { reason: 'LIFETIME' } }), lifetime - 2_000)
						: undefined;
				return () => {
					if (warn) clearTimeout(warn);
					this.hub.remove(connection);
				};
			},
			{ maxLifetimeMs: lifetime, heartbeatMs: this.options.heartbeatMs },
		);
	}

	private publish(entry: IEventCatalogEntryWithModule, payload: unknown, id: string, at: string): void {
		let message: ISseMessage;
		try {
			message = {
				id,
				type: entry.type,
				scope: entry.scope?.(payload) ?? {},
				data: entry.project?.(payload) ?? {},
				at,
			};
		} catch (err) {
			console.error(`[sse] could not map ${entry.type}:`, (err as Error)?.message);
			return;
		}
		void Promise.resolve(this.broadcaster.publish(message)).catch((err: unknown) =>
			console.error('[sse] publish failed:', (err as Error)?.message),
		);
	}
}
