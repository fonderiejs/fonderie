import type { NotificationEvent } from '@fonderie/events';

// The wire contract with @fonderie/events, declared locally: events is an
// optional peer, and a value import would hard-require it at module load even
// though every emit is conditional (bus?.emit).
export const NOTIFICATION_EVENT: NotificationEvent = 'fonderie.notification.send';
