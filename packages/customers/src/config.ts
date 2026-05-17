export const EVENT_KEYS = {
	customerCreated: 'customer.created',
	customerUpdated: 'customer.updated',
	customerDeleted: 'customer.deleted',
	customerArchived: 'customer.archived',
	customerRestored: 'customer.restored',
} as const;

export type CustomersEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

export type ICustomersConfig = {};
