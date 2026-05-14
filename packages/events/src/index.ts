export { EventBus } from './bus';
export { EventsModule } from './module';
export type { IEventsConfig, EventTransportConfig } from './module';

export { MemoryTransport, PGTransport } from './transports';
export type { IEventTransport, IPGTransportConfig } from './transports';

export { matchesPattern } from './transports/pattern';

export type { IEventMeta, IEventHandler, IEventRecord, IConsumerRecord } from './types';

// ── Typed event keys ─────────────────────────────────────────────
// Each domain package re-exports its own EVENT_KEYS.
// Consumers alias on import:
//   import { EVENT_KEYS as AUTH_EVENT_KEYS } from '@fonderie-js/auth'

export const NOTIFICATION_EVENT = 'notification.send' as const;
export type NotificationEvent = typeof NOTIFICATION_EVENT;
