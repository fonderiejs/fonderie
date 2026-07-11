import pg from 'pg';

import { PGAdapter } from '@fonderie/store';
import type { IStoreAdapter } from '@fonderie/store';
import type { IEventTransport } from './types';
import type { IEventMeta, IEventHandler, IEventRecord } from '../types';
import { matchesPattern } from './pattern';

export interface IPGTransportConfig {
	connectionUrl: string;
	maxRetries?: number; // default 3
	batchSize?: number; // default 10 rows claimed per consumer per poll cycle
	pollInterval?: number; // default 1000ms fallback poll when no NOTIFY arrives
}

interface Subscription {
	pattern: string;
	handler: IEventHandler;
	consumer: string;
}

export class PGTransport implements IEventTransport {
	private subscriptions: Subscription[] = [];
	private listenClient: pg.Client | null = null;
	private store!: IStoreAdapter;
	private running = false;
	private wakeResolvers: Array<() => void> = [];

	private readonly maxRetries: number;
	private readonly batchSize: number;
	private readonly pollInterval: number;

	constructor(private config: IPGTransportConfig) {
		this.maxRetries = config.maxRetries ?? 3;
		this.batchSize = config.batchSize ?? 10;
		this.pollInterval = config.pollInterval ?? 1_000;
	}

	// ── Public API ──────────────────────────────────────────────────

	subscribe(pattern: string, handler: IEventHandler, consumer: string): void {
		this.subscriptions.push({ pattern, handler, consumer });
	}

	async publish(type: string, payload: unknown, meta: IEventMeta): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_events (id, type, payload, meta)
			 VALUES ($1, $2, $3, $4)`,
			[meta.id, type, JSON.stringify(payload), JSON.stringify(meta)],
		);

		const consumers = this.matchingConsumers(type);
		if (consumers.length > 0) {
			await this.store.query(
				`INSERT INTO fonderie_event_consumers (event_id, consumer, status, attempts)
				 SELECT $1, unnest($2::text[]), 'pending', 0
				 ON CONFLICT (event_id, consumer) DO NOTHING`,
				[meta.id, consumers],
			);
		}

		// NOTIFY carries no payload — it is a wake signal only
		await this.store.query(`SELECT pg_notify('fonderie_events', '')`);
	}

	async start(): Promise<void> {
		this.running = true;
		this.store = new PGAdapter(this.config.connectionUrl);

		// Reset any rows left in 'processing' by a crashed instance
		await this.store.query(
			`UPDATE fonderie_event_consumers SET status = 'failed' WHERE status = 'processing'`,
		);

		this.listenClient = new pg.Client(this.config.connectionUrl);
		await this.listenClient.connect();
		await this.listenClient.query('LISTEN fonderie_events');

		this.listenClient.on('notification', () => this.wake());
		this.listenClient.on('error', (err) =>
			console.error('[events:pg] listen client error:', err.message),
		);

		this.runPollLoop().catch((err) => console.error('[events:pg] poll loop crashed:', err));
	}

	async stop(): Promise<void> {
		this.running = false;
		this.wake();
		await this.listenClient?.end();
		this.listenClient = null;
	}

	// ── Poll loop ───────────────────────────────────────────────────

	private async runPollLoop(): Promise<void> {
		while (this.running) {
			try {
				const hadWork = await this.pollAllConsumers();
				if (!hadWork) await this.sleep();
			} catch (err) {
				console.error('[events:pg] poll error:', err);
				await this.sleep();
			}
		}
	}

	private async pollAllConsumers(): Promise<boolean> {
		const consumers = [...new Set(this.subscriptions.map((s) => s.consumer))];
		const results = await Promise.all(consumers.map((c) => this.pollConsumer(c)));
		return results.some((n) => n > 0);
	}

	private async pollConsumer(consumer: string): Promise<number> {
		const claimed = await this.store.query<{ event_id: string }>(
			`UPDATE fonderie_event_consumers c
			 SET status = 'processing', attempts = c.attempts + 1
			 FROM (
			   SELECT event_id
			   FROM   fonderie_event_consumers
			   WHERE  consumer = $1
			     AND  status IN ('pending', 'failed')
			     AND  attempts < $2
			   ORDER BY event_id
			   LIMIT $3
			   FOR UPDATE SKIP LOCKED
			 ) AS locked
			 WHERE c.event_id = locked.event_id
			   AND c.consumer = $1
			 RETURNING c.event_id`,
			[consumer, this.maxRetries, this.batchSize],
		);

		await Promise.all(claimed.map((row) => this.processConsumerEvent(consumer, row.event_id)));
		return claimed.length;
	}

	// ── Event processing ────────────────────────────────────────────

	private async processConsumerEvent(consumer: string, eventId: string): Promise<void> {
		const [event] = await this.store.query<IEventRecord>(
			`SELECT type, payload, meta FROM fonderie_events WHERE id = $1`,
			[eventId],
		);
		if (!event) return;

		const handlers = this.subscriptions
			.filter((s) => s.consumer === consumer && matchesPattern(s.pattern, event.type))
			.map((s) => s.handler);

		try {
			await Promise.all(handlers.map((h) => h(event.payload, event.meta)));
			await this.store.query(
				`UPDATE fonderie_event_consumers
				 SET status = 'processed', processed_at = now()
				 WHERE event_id = $1 AND consumer = $2`,
				[eventId, consumer],
			);
		} catch (err) {
			await this.store.query(
				`UPDATE fonderie_event_consumers
				 SET status = CASE WHEN attempts >= $1 THEN 'dead' ELSE 'failed' END,
				     error  = $2
				 WHERE event_id = $3 AND consumer = $4`,
				[this.maxRetries, err instanceof Error ? err.message : String(err), eventId, consumer],
			);
		}
	}

	// ── Helpers ─────────────────────────────────────────────────────

	private matchingConsumers(eventType: string): string[] {
		const seen = new Set<string>();
		for (const sub of this.subscriptions) {
			if (matchesPattern(sub.pattern, eventType)) seen.add(sub.consumer);
		}
		return [...seen];
	}

	private sleep(): Promise<void> {
		return new Promise<void>((resolve) => {
			let timer: ReturnType<typeof setTimeout>;
			const wake = () => {
				clearTimeout(timer);
				resolve();
			};
			timer = setTimeout(() => {
				const idx = this.wakeResolvers.indexOf(wake);
				if (idx !== -1) this.wakeResolvers.splice(idx, 1);
				resolve();
			}, this.pollInterval);
			this.wakeResolvers.push(wake);
		});
	}

	private wake(): void {
		this.wakeResolvers.shift()?.();
	}
}
