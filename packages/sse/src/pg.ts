// Fan-out across instances with Postgres LISTEN/NOTIFY — '@fonderie/sse/pg'.
// `pg` is an optional peer: only apps that use this subpath need it.
//
// Needs a SESSION-mode connection (a direct URL or a session pooler): LISTEN
// does not survive a transaction-mode pooler. Producers can stay serverless;
// the stream hosts that hold this connection are long-running.
import pg from 'pg';

import type { IBroadcaster, ISseMessage } from './types';

const CHANNEL = 'fonderie_sse';

export interface IPgBroadcasterOptions {
	/**
	 * Postgres URL. Session mode when listening (LISTEN needs a dedicated
	 * connection); with `listen: false` a transaction-mode pooler is fine —
	 * NOTIFY is an ordinary statement.
	 */
	connectionString: string;
	/** Channel carrying SSE messages between instances. Default 'fonderie_sse'. */
	channel?: string;
	/**
	 * false: publish only (no LISTEN, no delivery) — for a serverless producer
	 * running SseModule({ streams: false }). Default true.
	 */
	listen?: boolean;
}

export class PgBroadcaster implements IBroadcaster {
	private client: pg.Client | undefined;
	private pool: pg.Pool | undefined;
	private readonly channel: string;
	private readonly subscribers = new Set<(message: ISseMessage) => void>();
	private readonly listeners = new Map<string, Set<(payload: string) => void>>();

	constructor(private readonly options: IPgBroadcasterOptions) {
		this.channel = options.channel ?? CHANNEL;
		if (!/^[a-z_][a-z0-9_]*$/.test(this.channel)) throw new Error(`[sse] invalid channel name '${this.channel}'`);
	}

	async start(): Promise<void> {
		if (this.options.listen === false) {
			// One short-lived pooled connection per instance; idle ones close
			// quickly so a serverless instance does not pin a pooler slot.
			this.pool ??= new pg.Pool({ connectionString: this.options.connectionString, max: 1, idleTimeoutMillis: 5_000 });
			return;
		}
		if (this.client) return;
		const client = new pg.Client({ connectionString: this.options.connectionString });
		client.on('notification', (n) => this.onNotification(n.channel, n.payload ?? ''));
		client.on('error', (err) => console.error('[sse] LISTEN connection error:', err.message));
		await client.connect();
		await client.query(`LISTEN ${this.channel}`);
		this.client = client;
	}

	async stop(): Promise<void> {
		const client = this.client;
		const pool = this.pool;
		this.client = undefined;
		this.pool = undefined;
		await client?.end().catch(() => {});
		await pool?.end().catch(() => {});
	}

	async publish(message: ISseMessage): Promise<void> {
		const target = this.client ?? this.pool;
		if (!target) throw new Error('[sse] PgBroadcaster not started');
		// A reference-sized message (ids only) — far below NOTIFY's 8 KB limit.
		await target.query('SELECT pg_notify($1, $2)', [this.channel, JSON.stringify(message)]);
	}


	subscribe(onMessage: (message: ISseMessage) => void): () => void {
		this.subscribers.add(onMessage);
		return () => {
			this.subscribers.delete(onMessage);
		};
	}

	async listen(channel: string, onPayload: (payload: string) => void): Promise<() => void> {
		if (this.options.listen === false) throw new Error('[sse] a publish-only PgBroadcaster (listen: false) cannot listen');
		if (!/^[a-z_][a-z0-9_]*$/.test(channel)) throw new Error(`[sse] invalid channel name '${channel}'`);
		if (!this.client) throw new Error('[sse] PgBroadcaster not started');
		let set = this.listeners.get(channel);
		if (!set) {
			set = new Set();
			this.listeners.set(channel, set);
			await this.client.query(`LISTEN ${channel}`);
		}
		set.add(onPayload);
		return () => {
			set?.delete(onPayload);
		};
	}

	private onNotification(channel: string, payload: string): void {
		if (channel === this.channel) {
			let message: ISseMessage;
			try {
				message = JSON.parse(payload) as ISseMessage;
			} catch {
				return;
			}
			for (const deliver of this.subscribers) deliver(message);
			return;
		}
		for (const onPayload of this.listeners.get(channel) ?? []) onPayload(payload);
	}
}
