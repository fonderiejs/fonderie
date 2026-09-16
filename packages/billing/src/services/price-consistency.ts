import type { IBillingConfig } from '../config';
import type { IBillingProvider } from '../providers/types';

/** One catalog entry compared against the price the provider actually holds. */
export interface IPriceConsistencyEntry {
	/** 'plan:unlimited:monthly' or 'pack:small' — enough to find it in the catalog. */
	ref: string;
	priceId: string;
	/** What the catalog says. */
	declared: { amount: string; currency: string };
	/** What the provider says, or null when the price could not be read. */
	actual: { amount: string; currency: string } | null;
	/** Populated when they disagree, or when the price is missing/inactive. */
	problem: 'amount' | 'currency' | 'both' | 'missing' | 'inactive' | null;
}

export interface IPriceConsistencyReport {
	/** True when the provider exposes no price lookup (or a test double). */
	unsupported?: boolean;
	error?: string;
	entries: IPriceConsistencyEntry[];
	ok: boolean;
}

const money = (amount: bigint, currency: string) => ({
	amount: amount.toString(),
	currency: currency.toLowerCase(),
});

/**
 * Compare the catalog's prices against the ones the provider actually holds.
 *
 * Two sources of truth exist by design, and they are not treated alike — which
 * is the actual risk:
 *
 *   - A PLAN's `amount` is documented as a display value. The provider is the
 *     authority; a mismatch is a wrong price on a pricing page.
 *   - A PACK's `priceAmount`/`currency` are authoritative for the saved-card and
 *     auto-recharge paths, while hosted checkout uses the provider's price. A
 *     mismatch means the same pack costs DIFFERENT AMOUNTS depending on how it
 *     is bought.
 *
 * They are supposed to agree. Nothing enforces it.
 *
 * Observed in practice: a catalog declaring USD against provider prices in CAD.
 * Same figures, different currency, so the same pack cost ~37% more through one
 * purchase path than another — and nothing failed, because each path was
 * internally consistent. It surfaced only when a receipt started printing the
 * real charge currency.
 *
 * This cannot be a `checkReadiness()` hook: that contract is synchronous and
 * reading prices is a network call. Run it at boot, or from whatever scheduled
 * ops route already exists — the same treatment `checkWebhookRegistration` gets,
 * for the same reason.
 *
 * Never throws: a diagnostic must not take down the thing it diagnoses. A
 * provider without price lookup reports `unsupported` rather than failing —
 * absence of the capability is not evidence of a problem.
 */
export async function checkPriceConsistency(
	provider: Pick<IBillingProvider, 'resolvePriceById'>,
	config: Pick<IBillingConfig, 'plans' | 'wallet'>,
): Promise<IPriceConsistencyReport> {
	if (typeof provider.resolvePriceById !== 'function') {
		return { unsupported: true, entries: [], ok: true };
	}

	// Only entries with a priceId can disagree — without one the catalog IS the
	// only source, so there is nothing to reconcile.
	const targets: { ref: string; priceId: string; amount: bigint; currency: string }[] = [];

	for (const plan of config.plans ?? []) {
		for (const [interval, price] of [
			['monthly', plan.monthly],
			['yearly', plan.yearly],
		] as const) {
			// A plan's `amount` is explicitly a DISPLAY amount — the provider is
			// already the authority for what a subscription costs. With none
			// declared there is nothing to disagree with, so skip rather than
			// compare against a zero.
			if (price?.priceId && price.amount !== undefined) {
				targets.push({
					ref: `plan:${plan.name}:${interval}`,
					priceId: price.priceId,
					amount: price.amount,
					// Plan prices carry no currency of their own; the provider's is
					// authoritative, so only the amount is compared.
					currency: '',
				});
			}
		}
	}

	for (const pack of config.wallet?.creditPacks ?? []) {
		if (pack.priceId) {
			targets.push({
				ref: `pack:${pack.id}`,
				priceId: pack.priceId,
				amount: pack.priceAmount,
				currency: pack.currency ?? '',
			});
		}
	}

	const entries: IPriceConsistencyEntry[] = [];
	for (const t of targets) {
		let resolved: Awaited<ReturnType<NonNullable<IBillingProvider['resolvePriceById']>>> = null;
		try {
			resolved = await provider.resolvePriceById(t.priceId);
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : String(err),
				entries,
				ok: false,
			};
		}

		const declared = money(t.amount, t.currency);
		if (!resolved) {
			entries.push({ ref: t.ref, priceId: t.priceId, declared, actual: null, problem: 'missing' });
			continue;
		}

		const actual = money(resolved.unitAmount, resolved.currency);
		const amountDiffers = resolved.unitAmount !== t.amount;
		// An empty declared currency means the catalog does not state one, so
		// there is nothing to disagree with — not a silent pass of a real gap.
		const currencyDiffers =
			t.currency !== '' && resolved.currency.toLowerCase() !== t.currency.toLowerCase();

		const problem: IPriceConsistencyEntry['problem'] = !resolved.active
			? 'inactive'
			: amountDiffers && currencyDiffers
				? 'both'
				: amountDiffers
					? 'amount'
					: currencyDiffers
						? 'currency'
						: null;

		entries.push({ ref: t.ref, priceId: t.priceId, declared, actual, problem });
	}

	return { entries, ok: entries.every((e) => e.problem === null) };
}

/** One line per problem, for a log. Empty when everything agrees. */
export function describePriceProblems(report: IPriceConsistencyReport): string[] {
	if (report.unsupported) return [];
	if (report.error) return [`price check failed: ${report.error}`];
	return report.entries
		.filter((e) => e.problem !== null)
		.map((e) => {
			if (e.problem === 'missing') return `${e.ref}: price ${e.priceId} not found at the provider`;
			if (e.problem === 'inactive') return `${e.ref}: price ${e.priceId} is INACTIVE at the provider`;
			const d = `${e.declared.amount} ${e.declared.currency || '(no currency)'}`;
			const a = `${e.actual?.amount} ${e.actual?.currency}`;
			return `${e.ref}: catalog says ${d}, provider charges ${a} — the saved-card and auto-recharge paths use the catalog, hosted checkout uses the provider`;
		});
}
