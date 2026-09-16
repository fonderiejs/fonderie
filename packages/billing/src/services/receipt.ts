import { formatWalletAmount } from '../utils';

/**
 * The one place a purchase-receipt payload is built.
 *
 * Three separate call sites emit `billing.payment-receipt` — the in-app saved-card
 * purchase, the hosted-checkout webhook, and auto-recharge — and each used to
 * assemble its own `data` object. When the template gained fields, only one site
 * was updated, so receipts from the other two rendered with blank amounts and no
 * reference lines. Nothing failed: missing variables interpolate to empty, so the
 * email arrives looking like a receipt with the numbers rubbed out.
 *
 * The template-coverage test did not catch it either, because it validates the
 * template against SAMPLE_PAYLOADS — one idealised payload — not against what the
 * emitters actually send.
 *
 * So the payload is built here, once. A call site can supply less (auto-recharge
 * knows no invoice; a direct card charge has no invoice number) but it cannot
 * silently supply a DIFFERENT SHAPE, and adding a field to the template means
 * adding it here rather than remembering three places.
 *
 * Every value is returned as a string, including the empty ones: the template's
 * `{{#key}}` blocks treat empty as absent, so an optional line disappears rather
 * than rendering a label with nothing after it.
 */
// `| undefined` is explicit on every optional: the repo runs
// exactOptionalPropertyTypes, where `?:` permits an ABSENT key but not one
// explicitly set to undefined — and callers forward fields that may be either.
export function buildReceiptData(args: {
	packId: string;
	/** Display name ("100 credits"). Falls back to packId, which is the internal one. */
	packName?: string | null | undefined;
	credits: bigint;
	creditCurrency: string;
	precision: number;
	balanceAfter: bigint;
	/** What was actually charged, in real money. Absent for a grant-like credit. */
	amountPaid?: bigint | null | undefined;
	paymentCurrency?: string | null | undefined;
	invoiceNumber?: string | null | undefined;
	invoiceUrl?: string | null | undefined;
	invoicePdf?: string | null | undefined;
	providerTxId?: string | null | undefined;
	source: string;
}): Record<string, string> {
	const {
		packId,
		packName,
		credits,
		creditCurrency,
		precision,
		balanceAfter,
		amountPaid,
		paymentCurrency,
		invoiceNumber,
		invoiceUrl,
		invoicePdf,
		providerTxId,
		source,
	} = args;

	// Money is formatted at 2dp regardless of the WALLET's precision: the wallet
	// may be whole counts (a credit balance at precision 0), but the amount paid
	// is currency and "$38" would be wrong on a receipt.
	const amountPaidDisplay =
		amountPaid !== undefined && amountPaid !== null
			? formatWalletAmount(amountPaid, paymentCurrency ?? creditCurrency, 2)
			: '';

	return {
		packId,
		packName: packName ?? packId,
		credits: credits.toString(),
		currency: creditCurrency,
		balanceAfter: balanceAfter.toString(),
		creditsDisplay: formatWalletAmount(credits, creditCurrency, precision),
		balanceAfterDisplay: formatWalletAmount(balanceAfter, creditCurrency, precision),
		amountPaid: amountPaid !== undefined && amountPaid !== null ? amountPaid.toString() : '',
		paymentCurrency: paymentCurrency ?? '',
		amountPaidDisplay,
		invoiceNumber: invoiceNumber ?? '',
		invoiceUrl: invoiceUrl ?? '',
		invoicePdf: invoicePdf ?? '',
		providerTxId: providerTxId ?? '',
		source,
	};
}
