// Typed wallet domain errors, mapped to HTTP explicitly where they surface
// (same catch-specific-else-rethrow shape as store's VersionConflictError):
// DuplicateTransactionError → 409 in the grant and payment-webhook handlers;
// InsufficientFundsError → 402 in product routes that debit. Note that
// requireWalletBalance answers its 402 from a pre-check without throwing, so
// a route that debits inside its unit of work should catch this error and
// reply with insufficientCreditsResponse() — the pre-check alone cannot
// reserve funds against a concurrent drain.

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
