export const EVENT_KEYS = {
	customerCreated: 'fonderie.customer.created',
	customerUpdated: 'fonderie.customer.updated',
	customerDeleted: 'fonderie.customer.deleted',
	customerBlacklisted: 'fonderie.customer.blacklisted',
	customerUnblacklisted: 'fonderie.customer.unblacklisted',
} as const;

export type CustomersEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

export const DEFAULT_REFERENCE_CODE_PREFIX = 'CLT';

export type ICustomersConfig = {
	/** Prefix used when auto-generating customer reference codes. Defaults to DEFAULT_REFERENCE_CODE_PREFIX. */
	referenceCodePrefix?: string;
};
