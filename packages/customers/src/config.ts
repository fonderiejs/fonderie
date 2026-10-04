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
	/**
	 * Permission key guarding every customer route, e.g. 'customers'. Requires
	 * @fonderie/permissions. Reads need `read`; creating a customer `create`;
	 * deleting one `delete`; every other write (emails, phones, addresses,
	 * notes, tags, relationships, labels, blacklist) changes the customer and
	 * needs `update`. Unset: any workspace member may do anything, as before.
	 */
	permission?: string;
	/**
	 * Does something of the APP's still reference this customer (a job, a
	 * quote, an invoice)? Then delete is refused with 409 CUSTOMER_IN_USE and the
	 * customer can be archived instead. Database foreign keys onto
	 * fonderie_customers are caught the same way without this; use it when the
	 * references are not foreign keys.
	 */
	isInUse?: (customerId: string, workspaceId: string) => Promise<boolean>;
};
