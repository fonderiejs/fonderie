export const EVENT_KEYS = {
	customerCreated: 'fonderie.customer.created',
	customerUpdated: 'fonderie.customer.updated',
	customerDeleted: 'fonderie.customer.deleted',
	customerBlacklisted: 'fonderie.customer.blacklisted',
	customerUnblacklisted: 'fonderie.customer.unblacklisted',
} as const;

export type CustomersEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

export const DEFAULT_REFERENCE_CODE_PREFIX = 'CLT';

// Referral codes are RANDOM (not sequential like reference codes) so they are
// safe to share publicly — a customer can't guess another's by incrementing.
// Unambiguous alphabet: no 0/O, 1/I/L. 8 chars over 31 symbols ≈ 8.5e11 space,
// so collisions within a workspace are astronomically rare (and the unique
// index is the hard guard; generation retries on the vanishing chance).
export const REFERRAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const REFERRAL_CODE_LENGTH = 8;

export type ICustomersConfig = {
	/** Prefix used when auto-generating customer reference codes. Defaults to DEFAULT_REFERENCE_CODE_PREFIX. */
	referenceCodePrefix?: string;
};
