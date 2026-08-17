import type { IFonderieModule, IFonderieApp, IReadinessProblem } from '@fonderie/core';

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
			...(config.integrityKey !== undefined ? { integrityKey: config.integrityKey } : {}),
		});
	}

	return config as IEventTransport;
}

export class EventsModule implements IFonderieModule {
	readonly name = '@fonderie/events';
	readonly bus: EventBus;
	private readonly config: IEventsConfig;

	constructor(config: IEventsConfig) {
		this.config = config;
		this.bus = new EventBus(resolveTransport(config.transport));
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
			return [{
				module: this.name,
				severity: 'warning',
				message: 'no integrityKey — the event/audit log is not tamper-evident; set one to enable per-event HMACs',
			}];
		}
		return [];
	}
}
