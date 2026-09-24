import pg from 'pg';

import { PGAdapter } from '@fonderie/store';
import type { IStoreAdapter } from '@fonderie/store';
import type { IEventTransport } from './types';
import type { IEventMeta, IEventHandler, IEventRecord } from '../types';
import { matchesPattern } from './pattern';
import { computeEventHmac } from '../integrity';
import { explainListenFailure } from '../diagnose';

export interface IConsumerBacklog {
	consumer: string;
	waiting: number;
	/** Age of the oldest waiting row, in minutes. */
	oldestMinutes: number;
}

export interface IDeadLetter {
	eventId: string;
	consumer: string;
	type: string;
	attempts: number;
	lastError: string | null;
	createdAt: Date;
}

export interface IPGTransportConfig {
	connectionUrl: string;
	maxRetries?: number; // default 3
	batchSize?: number; // default 10 rows claimed per consumer per poll cycle
	pollInterval?: number; // default 1000ms fallback poll when no NOTIFY arrives
	/**
	 * Whether this instance consumes. Default true.
	 *
	 * `false` connects for PUBLISHING only — no LISTEN client, no poll loop.
	 * That is what a serverless producer needs: it must write durable rows, but
	 * it cannot host a loop that never returns, and LISTEN is not supported
	 * through a transaction-mode pooler (Supabase's 6543) at all. Delivery then
	 * belongs to whatever does consume — a worker running start(), or a
	 * scheduled ping calling drain(), which still works here because the store
	 * is connected either way.
	 */
	consume?: boolean;
	/**
	 * How long a claimed row may stay `processing` before another consumer may
	 * reclaim it. Default 5 minutes.
	 *
	 * This is a visibility timeout, and it is the only safe way to recover rows
	 * abandoned by a crashed instance once more than one consumer exists. The
	 * obvious alternative — resetting every `processing` row on startup — cannot
	 * tell "abandoned by a process that died" from "in flight in a process still
	 * working on it", so it hands a live consumer's row to a second one and the
	 * side effect happens twice. For an outbox that sends email, that is a
	 * duplicate in someone's inbox.
	 *
	 * Set it above the slowest handler, comfortably: too low resurrects live
	 * work, too high only delays recovery from a genuine crash.
	 */
	claimTimeoutMs?: number;
	// When set, every event is stored with a keyed HMAC over its immutable
	// content, making the audit log tamper-evident. Unset → no HMAC (unchanged
	// behaviour). Verify later with `verifyEventChain(store, integrityKey)`.
	integrityKey?: string;
}

interface Subscription {
	pattern: string;
	handler: IEventHandler;
	consumer: string;
}

export class PGTransport implements IEventTransport {
	private subscriptions: Subscription[] = [];
	private listenClient: pg.Client | null = null;
	private store: IStoreAdapter | undefined;
	// The same object as `store`, held at its concrete type so stop() can close
	// it. IStoreAdapter is query+transaction only — it has no lifecycle — so a
	// pool reached through that interface cannot be released, and an optional
	// `end?.()` would compile to a silent no-op the day it went missing. This
	// field makes the close a checked call.
	private ownedStore: PGAdapter | null = null;
	private running = false;
	private wakeResolvers: Array<() => void> = [];
	// Held so stop() can WAIT for the loop instead of merely asking it to finish.
	// Without this, stop() could return while a poll query was still in flight,
	// and ending the pool underneath it races an active client.
	private pollLoop: Promise<void> | null = null;

	private readonly maxRetries: number;
	private readonly batchSize: number;
	private readonly pollInterval: number;
	private readonly claimTimeoutMs: number;
	private readonly integrityKey: string | undefined;

	constructor(private config: IPGTransportConfig) {
		this.maxRetries = config.maxRetries ?? 3;
		this.batchSize = config.batchSize ?? 10;
		this.pollInterval = config.pollInterval ?? 1_000;
		this.claimTimeoutMs = config.claimTimeoutMs ?? 300_000;
		this.integrityKey = config.integrityKey;
	}

	// ── Public API ──────────────────────────────────────────────────

	subscribe(pattern: string, handler: IEventHandler, consumer: string): void {
		this.subscriptions.push({ pattern, handler, consumer });
	}

	async publish(type: string, payload: unknown, meta: IEventMeta): Promise<void> {
		// Unguarded, this was a bare "Cannot read properties of undefined" —
		// before start(), and now also after stop(). Name the cause instead.
		if (!this.store)
			throw new Error('[events:pg] transport is not started — call start() before publish()');
		const hmac = this.integrityKey
			? computeEventHmac(this.integrityKey, { id: meta.id, type, payload, meta })
			: null;
		await this.store.query(
			`INSERT INTO fonderie_events (id, type, payload, meta, hmac)
			 VALUES ($1, $2, $3, $4, $5)`,
			[meta.id, type, JSON.stringify(payload), JSON.stringify(meta), hmac],
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
		this.ownedStore = new PGAdapter(this.config.connectionUrl);
		this.store = this.ownedStore;

		// Producer-only: connected enough to publish, and nothing else. Starting
		// the consumer here would open a LISTEN connection per instance — which a
		// transaction-mode pooler rejects outright — and a loop that never
		// returns, which a serverless invocation cannot host.
		if (this.config.consume === false) return;

		// Rows abandoned by a crashed instance are NOT reset here. Claiming is
		// what reclaims them, once they have been stale longer than
		// claimTimeoutMs — see pollConsumer. Resetting them on boot would also
		// reset the rows another consumer is working on right now.

		this.listenClient = new pg.Client(this.config.connectionUrl);
		await this.listenClient.connect();
		try {
			await this.listenClient.query('LISTEN fonderie_events');
		} catch (err) {
			// Fail with the cause and both fixes rather than a raw "unsupported
			// statement" on a connection string that works everywhere else in the
			// app — see explainListenFailure.
			await this.listenClient.end().catch(() => {});
			this.listenClient = null;
			throw new Error(`[events:pg] ${explainListenFailure(err)}`);
		}

		this.listenClient.on('notification', () => this.wake());
		this.listenClient.on('error', (err) =>
			console.error('[events:pg] listen client error:', err.message),
		);

		this.pollLoop = this.runPollLoop().catch((err) =>
			console.error('[events:pg] poll loop crashed:', err),
		);
	}

	/**
	 * Release everything `start()` acquired. Must leave NOTHING holding the
	 * event loop open, or a process that stops the bus never exits.
	 *
	 * It used to end the LISTEN client and stop there, leaking the connection
	 * pool `start()` created — in every process, not just tests. That is what
	 * hung CI: `npm test` finished, every suite printed `fail 0`, and turbo
	 * waited forever on an events test process whose pools were still open. It
	 * cost six release cycles and survived two bisects, because whether the
	 * process eventually exits depends on an idle-timeout racing an in-flight
	 * poll query — so it reproduced roughly three times a day and never once on
	 * demand.
	 *
	 * Order matters: stop the loop, wait for it to actually finish, and only
	 * then end the pool it was querying.
	 */
	async stop(): Promise<void> {
		this.running = false;
		this.wake();

		// Wait for the loop to observe `running === false` and return. It cannot
		// reject — runPollLoop's caller already caught — but it can still be
		// mid-query, which is the case this await exists for.
		await this.pollLoop;
		this.pollLoop = null;

		await this.listenClient?.end();
		this.listenClient = null;

		// The pool. `start()` assigns it unconditionally, including for
		// producer-only transports that return before opening anything else, so
		// this must run on that path too.
		await this.ownedStore?.end();
		this.ownedStore = null;

		// Back to the pre-start state. The reads below guard on `!this.store`
		// and are documented as safe to call unconditionally from a health
		// route — leaving the field pointing at an ENDED pool would turn
		// "return empty" into "throw", which is a worse regression than the
		// leak for anything that polls health after shutdown.
		this.store = undefined;
	}

	/**
	 * Process everything currently pending, then return.
	 *
	 * `start()` is the right consumer on a host that outlives the request — it
	 * LISTENs and delivers immediately. It cannot be used where the process is
	 * expected to return (serverless), because it never does. `drain()` is the
	 * same work in a bounded form, so a scheduled ping can consume the outbox
	 * without any long-running process.
	 *
	 * That is what makes the outbox topology-independent: producers always
	 * write a durable row, and the deployment picks a consumer — `start()` or
	 * `drain()` — without either side changing.
	 *
	 * Bounded by `maxMs` so an invocation cannot outlive its own timeout; work
	 * left over stays pending and is picked up by the next call.
	 */
	async drain(options: { maxMs?: number } = {}): Promise<void> {
		// Answer emptily before the transport is connected, as deadLetters() and
		// pendingCount() do — a health route or a shutdown path should not have to
		// know whether boot got far enough.
		if (!this.store) return;
		const deadline = Date.now() + (options.maxMs ?? 25_000);
		// No blanket reclaim here. drain() is the serverless consumer, so several
		// instances run it CONCURRENTLY; resetting every 'processing' row would
		// mean each new invocation stealing the rows the others are mid-send on,
		// and the same email going out repeatedly. Stale rows are reclaimed by
		// the claim query itself, under a row lock.
		while (Date.now() < deadline) {
			const hadWork = await this.pollAllConsumers();
			if (!hadWork) break;
		}
	}

	/**
	 * Events that exhausted their retries, newest first.
	 *
	 * A dead row is the end of the line: the work is durable and was retried,
	 * but it will never be delivered. Until something surfaces these, a queue
	 * that has silently stopped delivering looks exactly like one with nothing
	 * to do — which is the failure mode an outbox is supposed to eliminate.
	 * Expose it from a health route or check it on a schedule.
	 */
	// For the doctor's integrity check; null before start().
	storeForIntegrity(): IStoreAdapter | null {
		return this.store ?? null;
	}

	async deadLetters(limit = 50): Promise<IDeadLetter[]> {
		if (!this.store) return [];
		return this.store.query<IDeadLetter>(
			`SELECT c.event_id AS "eventId", c.consumer, c.attempts, c.error AS "lastError",
			        e.type, e.created_at AS "createdAt"
			   FROM fonderie_event_consumers c
			   JOIN fonderie_events e ON e.id = c.event_id
			  WHERE c.status = 'dead'
			  ORDER BY e.created_at DESC
			  LIMIT $1`,
			[limit],
		);
	}

	/**
	 * Waiting work, broken down BY CONSUMER — and the age of the oldest.
	 *
	 * A single total conflates queues that have nothing to do with each other:
	 * every consumer subscribed to this bus shares one table, so a job parked
	 * for a worker you deliberately do not deploy is indistinguishable from a
	 * notification nobody delivered. Same number, opposite meanings.
	 *
	 * The age matters as much as the count. "1 waiting" is a consumer that is
	 * briefly behind; "1 waiting, 200 minutes old" is a customer who is never
	 * getting their result.
	 */
	async pendingByConsumer(): Promise<IConsumerBacklog[]> {
		if (!this.store) return [];
		return this.store.query<IConsumerBacklog>(
			`SELECT c.consumer, count(*)::int AS waiting,
			        coalesce(
			          round(extract(epoch FROM now() - min(e.created_at)) / 60)::int,
			          0
			        ) AS "oldestMinutes"
			   FROM fonderie_event_consumers c
			   JOIN fonderie_events e ON e.id = c.event_id
			  WHERE c.status IN ('pending', 'failed')
			  GROUP BY c.consumer
			  ORDER BY c.consumer`,
		);
	}

	/** How many events are waiting — a backlog that only grows means nobody is consuming. */
	async pendingCount(): Promise<number> {
		if (!this.store) return 0;
		const [row] = await this.store.query<{ count: string }>(
			`SELECT count(*)::text AS count FROM fonderie_event_consumers
			  WHERE status IN ('pending', 'failed')`,
		);
		return Number(row?.count ?? 0);
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
		// Read the store ONCE per cycle and hand it down. stop() clears the
		// field after awaiting this loop, so it is present here — but a future
		// edit that reorders stop() would turn every `this.store.query` below
		// into a crash inside a detached promise. Passing it means the check
		// happens in one place and the rest cannot get it wrong.
		const store = this.store;
		if (!store) return false;
		const consumers = [...new Set(this.subscriptions.map((s) => s.consumer))];
		const results = await Promise.all(consumers.map((c) => this.pollConsumer(store, c)));
		return results.some((n) => n > 0);
	}

	private async pollConsumer(store: IStoreAdapter, consumer: string): Promise<number> {
		const claimed = await store.query<{ event_id: string }>(
			// 'processing' rows older than the visibility timeout are claimable
			// too: that is how work abandoned by a crashed instance comes back,
			// without a blanket reset that cannot see who is still alive. The row
			// lock makes the reclaim exclusive, so two consumers racing for the
			// same stale row produce one winner, not two sends.
			`UPDATE fonderie_event_consumers c
			 SET status = 'processing', attempts = c.attempts + 1, claimed_at = now()
			 FROM (
			   SELECT event_id
			   FROM   fonderie_event_consumers
			   WHERE  consumer = $1
			     AND  attempts < $2
			     AND  (
			            status IN ('pending', 'failed')
			            OR (status = 'processing'
			                AND claimed_at < now() - make_interval(secs => $4))
			          )
			   ORDER BY event_id
			   LIMIT $3
			   FOR UPDATE SKIP LOCKED
			 ) AS locked
			 WHERE c.event_id = locked.event_id
			   AND c.consumer = $1
			 RETURNING c.event_id`,
			[consumer, this.maxRetries, this.batchSize, this.claimTimeoutMs / 1000],
		);

		await Promise.all(claimed.map((row) => this.processConsumerEvent(store, consumer, row.event_id)));
		return claimed.length;
	}

	// ── Event processing ────────────────────────────────────────────

	private async processConsumerEvent(
		store: IStoreAdapter,
		consumer: string,
		eventId: string,
	): Promise<void> {
		const [event] = await store.query<IEventRecord>(
			`SELECT type, payload, meta FROM fonderie_events WHERE id = $1`,
			[eventId],
		);
		if (!event) return;

		const handlers = this.subscriptions
			.filter((s) => s.consumer === consumer && matchesPattern(s.pattern, event.type))
			.map((s) => s.handler);

		try {
			await Promise.all(handlers.map((h) => h(event.payload, event.meta)));
			await store.query(
				`UPDATE fonderie_event_consumers
				 SET status = 'processed', processed_at = now()
				 WHERE event_id = $1 AND consumer = $2`,
				[eventId, consumer],
			);
		} catch (err) {
			await store.query(
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
