// Typed wallet domain errors. Services throw these; HTTP handlers catch and
// map them to setApiResponse statuses (402 / 409) — same catch-specific-else-
// rethrow shape as store's VersionConflictError.

export class InsufficientFundsError extends Error {
	constructor(
		readonly available: bigint,
		readonly required: bigint,
		readonly currency: string,
	) {
		super(
			`[billing:wallet] insufficient funds: available ${available}, required ${required} ${currency}`,
		);
		this.name = 'InsufficientFundsError';
	}
}

// An idempotency key was replayed against a DIFFERENT subscriber or currency
// than the ledger row it originally wrote — a caller bug (key reuse across
// scopes), never a safe retry. Same-scope replays are not errors: mutations
// return `{ duplicate: true }` for those.
export class DuplicateTransactionError extends Error {
	constructor(readonly idempotencyKey: string) {
		super(
			`[billing:wallet] idempotency key '${idempotencyKey}' was already used for a different subscriber or currency`,
		);
		this.name = 'DuplicateTransactionError';
	}
}
