import type {
	IAdminDescription,
	IFonderieModule,
	IFonderieApp,
	IReadinessProblem,
} from '@fonderie/core';

import { EventBus } from './bus';
import { PGTransport } from './transports/pg';
import { verifyEventChain } from './integrity';
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
		const cfg = this.config.transport;
		const key = 'type' in cfg && cfg.type === 'pg' ? cfg.integrityKey : undefined;
		return {
			checks: [
				// The audit trail is tamper-evident only with a key; a tampered row
				// is a hard failure, rows published before the key are advice.
				{
					name: 'events.integrity',
					run: async () => {
						if (!key)
							return {
								ok: true,
								findings: [],
								skipped: 'no integrityKey — the event log is not tamper-evident',
							};
						const store = t.storeForIntegrity();
						if (!store) return { ok: true, findings: [], skipped: 'transport not started' };
						const r = await verifyEventChain(store, key);
						const findings = r.tampered.map(
							(id) => `event ${id}: stored HMAC does not match — tampered`,
						);
						if (r.unprotected > 0)
							findings.push(
								`${r.unprotected} row(s) carry no HMAC (published before integrity was enabled)`,
							);
						return { ok: r.ok, findings };
					},
				},
				{
					name: 'events.outbox',
					run: async () => {
						const [dead, pending] = await Promise.all([t.deadLetters(10), t.pendingByConsumer()]);
						const findings = dead.map(
							(d) =>
								`${d.type} (${d.consumer}): ${d.lastError ?? 'no error recorded'} — dead, will never be delivered`,
						);
						for (const p of pending) {
							if (p.oldestMinutes >= STALE_BACKLOG_MINUTES) {
								findings.push(`${p.consumer}: ${p.waiting} waiting, oldest ${p.oldestMinutes} min`);
							}
						}
						return { ok: dead.length === 0, findings };
					},
				},
			],
		};
	}

	install(_app: IFonderieApp): void {
		this.bus.start().catch((err) => console.error('[events] failed to start transport', err));
	}

	// The event log doubles as the audit trail. Without an integrityKey it is
	// append-only but not tamper-evident, so a compromised DB write could alter
	// history undetectably — a finding worth surfacing (not fatal).
	checkReadiness(): IReadinessProblem[] {
		const t = this.config.transport;
		if ('type' in t && t.type === 'pg' && !t.integrityKey) {
			return [
				{
					module: this.name,
					severity: 'warning',
					message:
						'no integrityKey — the event/audit log is not tamper-evident; set one to enable per-event HMACs',
				},
			];
		}
		return [];
	}
}
