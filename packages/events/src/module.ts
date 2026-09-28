import type {
	IFinding,
	IAdminDescription,
	IFonderieModule,
	IFonderieApp,
	IReadinessProblem,
} from '@fonderie/core';

import { EventBus } from './bus';
import { PGTransport } from './transports/pg';
import type { IEventTransport } from './transports/types';

export type EventTransportConfig =
	| {
			type: 'pg';
			connectionUrl: string;
			maxRetries?: number;
			batchSize?: number;
			pollInterval?: number;
			/**
			 * Whether this instance consumes. Default true. `false` connects for
			 * PUBLISHING only — the mode a serverless producer needs, since it
			 * cannot host a poll loop that never returns and LISTEN is rejected
			 * by a transaction-mode pooler outright.
			 */
			consume?: boolean;
			/** How long a claimed row may stay `processing` before reclaim. */
			claimTimeoutMs?: number;
			// Enables tamper-evident audit logging (keyed HMAC per event).
			integrityKey?: string;
	  }
	| IEventTransport;

export interface IEventsConfig {
	transport: EventTransportConfig;
}

function resolveTransport(config: EventTransportConfig): IEventTransport {
	if ('type' in config && config.type === 'pg') {
		return new PGTransport({
			connectionUrl: config.connectionUrl,
			...(config.maxRetries !== undefined ? { maxRetries: config.maxRetries } : {}),
			...(config.batchSize !== undefined ? { batchSize: config.batchSize } : {}),
			...(config.pollInterval !== undefined ? { pollInterval: config.pollInterval } : {}),
			...(config.consume !== undefined ? { consume: config.consume } : {}),
			...(config.claimTimeoutMs !== undefined ? { claimTimeoutMs: config.claimTimeoutMs } : {}),
			...(config.integrityKey !== undefined ? { integrityKey: config.integrityKey } : {}),
		});
	}

	return config as IEventTransport;
}

const STALE_BACKLOG_MINUTES = 15;

export class EventsModule implements IFonderieModule {
	readonly name = '@fonderie/events';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';
	readonly bus: EventBus;
	private readonly config: IEventsConfig;
	private readonly transport: IEventTransport;

	constructor(config: IEventsConfig) {
		this.config = config;
		this.transport = resolveTransport(config.transport);
		this.bus = new EventBus(this.transport);
	}

	// A dead row will never deliver; a row waiting this long was not picked up
	// by the per-request drain and nothing else is looking.
	describeAdmin(): IAdminDescription {
		const t = this.transport;
		if (!(t instanceof PGTransport)) return {};
		// The key lives on the transport, however it was built: from a
		// `{ type: 'pg' }` config or handed over ready-made. Reading it from the
		// config alone reported "no integrityKey" for every app that passes its
		// own PGTransport, whatever that transport was signing with.
		const signed = t.hasIntegrityKey();
		return {
			checks: [
				// The audit trail is tamper-evident only with a key; a tampered row
				// is a hard failure, rows published before the key are advice.
				{
					name: 'events.integrity',
					run: async () => {
						if (!signed)
							return {
								ok: true,
								findings: [],
								skipped: {
									message: 'no integrityKey — the event log is not tamper-evident',
									domain: 'events',
									reason: 'NO_INTEGRITY_KEY',
								},
							};
						const r = await t.verifyIntegrity();
						if (!r)
							return {
								ok: true,
								findings: [],
								skipped: {
									message: 'transport not started',
									domain: 'events',
									reason: 'TRANSPORT_NOT_STARTED',
								},
							};
						const findings: IFinding[] = r.tampered.map((id) => ({
							message: `event ${id}: stored HMAC does not match — tampered`,
							domain: 'events',
							reason: 'EVENT_TAMPERED',
							metadata: { event: id },
						}));
						if (r.unprotected > 0)
							findings.push({
								message: `${r.unprotected} row(s) carry no HMAC (published before integrity was enabled)`,
								domain: 'events',
								reason: 'EVENTS_UNSIGNED',
								metadata: { count: r.unprotected },
								severity: 'advice',
							});
						return { ok: r.ok, findings };
					},
				},
				{
					name: 'events.outbox',
					run: async () => {
						const [dead, pending] = await Promise.all([t.deadLetters(10), t.pendingByConsumer()]);
						// The provider's error text is kept as data: it is whatever the
						// failing handler threw, not a sentence this module can translate.
						const findings: IFinding[] = dead.map((d) => ({
							message: `${d.type} (${d.consumer}): ${d.lastError ?? 'no error recorded'} — dead, will never be delivered`,
							domain: 'events',
							reason: 'EVENT_DEAD',
							metadata: { type: d.type, consumer: d.consumer, error: d.lastError ?? '' },
						}));
						for (const p of pending) {
							if (p.oldestMinutes >= STALE_BACKLOG_MINUTES) {
								findings.push({
									message: `${p.consumer}: ${p.waiting} waiting, oldest ${p.oldestMinutes} min`,
									domain: 'events',
									reason: 'BACKLOG_STALE',
									metadata: { consumer: p.consumer, waiting: p.waiting, minutes: p.oldestMinutes },
									severity: 'advice',
								});
							}
						}
						return { ok: dead.length === 0, findings };
					},
				},
			],
		};
	}

	/**
	 * Release the transport: its connection pool, LISTEN client and poll loop.
	 *
	 * EventBus.stop() delegates to the transport. Skipping it leaks a pg pool per
	 * process — and a transport whose stop() did not finish the job is what hung
	 * this repo's CI for six release cycles.
	 */
	async stop(): Promise<void> {
		await this.bus.stop();
	}

	install(_app: IFonderieApp): void {
		this.bus.start().catch((err) => console.error('[events] failed to start transport', err));
	}

	// The event log doubles as the audit trail. Without an integrityKey it is
	// append-only but not tamper-evident, so a compromised DB write could alter
	// history undetectably — a finding worth surfacing (not fatal).
	checkReadiness(): IReadinessProblem[] {
		const t = this.transport;
		if (!(t instanceof PGTransport)) return [];
		if (!t.hasIntegrityKey()) {
			return [
				{
					module: this.name,
					severity: 'warning',
					message:
						'no integrityKey — the event/audit log is not tamper-evident; set one to enable per-event HMACs',
					domain: 'events',
					reason: 'NO_INTEGRITY_KEY',
				},
			];
		}
		// Any non-empty key used to pass; a guessable one makes the HMACs forgeable,
		// so hold it to the same bar as every other Fonderie secret.
		const weak = t.integrityKeyProblem();
		if (weak) {
			return [
				{
					module: this.name,
					severity: 'warning',
					message:
						weak === 'too-short'
							? 'integrityKey is shorter than 32 characters — event HMACs are guessable; generate one with `openssl rand -hex 32`'
							: 'integrityKey looks like a placeholder — event HMACs are forgeable; generate one with `openssl rand -hex 32`',
					domain: 'events',
					reason: 'WEAK_INTEGRITY_KEY',
					metadata: { problem: weak },
				},
			];
		}
		return [];
	}
}
