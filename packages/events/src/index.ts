export { EventBus } from './bus';
export { EventsModule } from './module';
export type { IEventsConfig, EventTransportConfig } from './module';

export { MemoryTransport, PGTransport } from './transports';
export type { IEventTransport, IPGTransportConfig } from './transports';

export { matchesPattern } from './transports/pattern';

// Audit-log tamper-evidence
export { computeEventHmac, verifyEventChain, canonicalize } from './integrity';
export type { IHashableEvent, IIntegrityReport } from './integrity';

// Retention / disposal
export { purgeEvents } from './retention';
export type { IPurgeEventsOptions } from './retention';

export type { IEventMeta, IEventHandler, IEventRecord, IConsumerRecord } from './types';

// ── Typed event keys ─────────────────────────────────────────────
// Each domain package re-exports its own EVENT_KEYS.
// Consumers alias on import:
//   import { EVENT_KEYS as AUTH_EVENT_KEYS } from '@fonderie/auth'

export const NOTIFICATION_EVENT = 'fonderie.notification.send' as const;
export type NotificationEvent = typeof NOTIFICATION_EVENT;
