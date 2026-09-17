import type { IStoreAdapter } from '@fonderie/store';
import type { IBillingProvider } from '../providers/types';

/**
 * The fields whose disagreement actually changes what a customer gets.
 *
 * The PLAN is deliberately not among them. `fonderie_subscriptions` stores a
 * plan name while the provider's normalized `plan` is derived from the price
 * nickname — documented in INormalizedSubscription as a legacy fallback — so the
 * two disagree routinely on correctly-configured accounts. Comparing them would
 * report drift on every healthy subscription, and a check that is wrong when it
 * speaks is one people mute. Catching an out-of-band plan change needs
 * priceLookupKey stored alongside the row; until then this stays quiet about it
 * rather than guessing.
 */
export type DriftField = 'status' | 'currentPeriodEnd' | 'cancelAtPeriodEnd';

export interface ISubscriptionDrift {
	providerSubscriptionId: string;
	subscriberType: string;
	subscriberId: string;
	/** Empty when the provider has no such subscription. */
	fields: DriftField[];
	ours: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };
	/** Null when the provider does not have it at all. */
	theirs: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
	/**
	 * Which way the disagreement cuts, when it affects access:
	 *
	 *   over-granting  — we serve a paid plan the provider is not billing for.
	 *                    Costs money quietly, forever, and nobody complains.
	 *   under-granting — the provider is billing someone we are not serving.
	 *                    Costs money loudly, today, and is a support ticket.
	 *   metadata       — the disagreement does not change access (a renewal date,
	 *                    a pending cancellation, a plan change).
	 */
	impact: 'over-granting' | 'under-granting' | 'metadata';
}

export interface ISubscriptionDriftReport {
	/** True when the provider cannot be asked to read a subscription back. */
	unsupported?: boolean;
	error?: string;
	checked: number;
	/** Set when more rows exist than were checked — never a silent cap. */
	truncated?: { limit: number; note: string };
	drifted: ISubscriptionDrift[];
	ok: boolean;
}

/** Statuses under which a subscriber is actually served the paid product. */
const GRANTS_ACCESS = new Set(['active', 'trialing']);

const day = (d: string | Date | null | undefined): string | null => {
	if (!d) return null;
	const date = d instanceof Date ? d : new Date(d);
	return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

interface IRow {
	subscriberType: string;
	subscriberId: string;
	providerSubscriptionId: string | null;
	status: string;
	currentPeriodEnd: string | Date | null;
	cancelAtPeriodEnd: boolean | null;
}

/**
 * Compare our stored subscriptions against the provider's.
 *
 * `fonderie_subscriptions` is a MIRROR, fed entirely by webhooks. That is fine
 * while every delivery lands, and silently wrong the moment one does not — and
 * deliveries stop for ordinary reasons: an endpoint disabled over a weekend, a
 * retry budget exhausted after ~3 days, a payload shaped by an API version the
 * normalizer did not expect. Nothing in the app can tell a mirror that is
 * correct from one that stopped being updated, because both look identical from
 * the inside.
 *
 * So the question has to be asked of the provider. This is the only check in
 * this package that needed a new seam method to exist at all: the provider
 * interface could update, cancel and reactivate a subscription, but never read
 * one back.
 *
 * Reports only — it does not write. Repairing the mirror means changing who is
 * served a paid product, which is a decision the app owns; this tells it what
 * disagrees and which direction the disagreement cuts.
 *
 * Never throws: a diagnostic must not take down the thing it diagnoses.
 */
export async function checkSubscriptionDrift(
	provider: Pick<IBillingProvider, 'getSubscription'>,
	store: IStoreAdapter,
	opts: { limit?: number } = {},
): Promise<ISubscriptionDriftReport> {
	if (typeof provider.getSubscription !== 'function') {
		return { unsupported: true, checked: 0, drifted: [], ok: true };
	}

	const limit = opts.limit ?? 200;

	let rows: IRow[];
	try {
		// Ordered by renewal date descending: the rows whose disagreement costs
		// something are the current ones, so a truncated run checks those first
		// rather than an arbitrary slice.
		//
		// Terminal rows are included deliberately. "We say canceled, the provider
		// says active" is the under-granting case — a customer paying for nothing
		// — and filtering to non-terminal statuses would make it invisible.
		rows = await store.query<IRow>(
			`SELECT subscriber_type          AS "subscriberType",
			        subscriber_id            AS "subscriberId",
			        provider_subscription_id AS "providerSubscriptionId",
			        status,
			        current_period_end       AS "currentPeriodEnd",
			        cancel_at_period_end     AS "cancelAtPeriodEnd"
			   FROM fonderie_subscriptions
			  WHERE provider_subscription_id IS NOT NULL
			  ORDER BY current_period_end DESC NULLS LAST
			  LIMIT $1`,
			[limit + 1],
		);
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : String(err),
			checked: 0,
			drifted: [],
			ok: false,
		};
	}

	const truncated = rows.length > limit;
	if (truncated) rows = rows.slice(0, limit);

	const drifted: ISubscriptionDrift[] = [];
	for (const row of rows) {
		const id = row.providerSubscriptionId;
		if (!id) continue;

		let theirs: Awaited<ReturnType<NonNullable<IBillingProvider['getSubscription']>>>;
		try {
			theirs = await provider.getSubscription(id);
		} catch (err) {
			// One unreadable subscription must not blind the sweep to the rest, and
			// must not be reported as drift — an outage is not a disagreement.
			return {
				error: `reading ${id}: ${err instanceof Error ? err.message : String(err)}`,
				checked: drifted.length,
				drifted,
				ok: false,
			};
		}

		const ours = {
			status: row.status,
			currentPeriodEnd: day(row.currentPeriodEnd),
			cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
		};

		if (!theirs) {
			drifted.push({
				providerSubscriptionId: id,
				subscriberType: row.subscriberType,
				subscriberId: row.subscriberId,
				fields: [],
				ours,
				theirs: null,
				impact: GRANTS_ACCESS.has(row.status) ? 'over-granting' : 'metadata',
			});
			continue;
		}

		const their = {
			status: theirs.status,
			currentPeriodEnd: day(theirs.currentPeriodEnd),
			cancelAtPeriodEnd: Boolean(theirs.cancelAtPeriodEnd),
		};

		const fields: DriftField[] = [];
		if (ours.status !== their.status) fields.push('status');
		// Compared at DAY resolution: the provider moves the renewal timestamp by
		// seconds during retries and proration, and a check that fires on that
		// would be noise on a healthy account every single run.
		if (ours.currentPeriodEnd !== their.currentPeriodEnd) fields.push('currentPeriodEnd');
		if (ours.cancelAtPeriodEnd !== their.cancelAtPeriodEnd) fields.push('cancelAtPeriodEnd');

		if (fields.length === 0) continue;

		const weGrant = GRANTS_ACCESS.has(ours.status);
		const theyGrant = GRANTS_ACCESS.has(their.status);
		drifted.push({
			providerSubscriptionId: id,
			subscriberType: row.subscriberType,
			subscriberId: row.subscriberId,
			fields,
			ours,
			theirs: their,
			impact:
				weGrant && !theyGrant
					? 'over-granting'
					: !weGrant && theyGrant
						? 'under-granting'
						: 'metadata',
		});
	}

	return {
		checked: rows.length,
		...(truncated
			? {
					truncated: {
						limit,
						note: `more than ${limit} subscriptions exist; the most recent ${limit} by renewal date were checked. Raise \`limit\` to cover the rest.`,
					},
				}
			: {}),
		drifted,
		ok: drifted.length === 0,
	};
}

/** One line per drifted subscription, worst impact first. */
export function describeSubscriptionDrift(report: ISubscriptionDriftReport): string[] {
	if (report.unsupported) return [];
	if (report.error) return [`subscription drift check failed: ${report.error}`];

	// under-granting first: a paying customer locked out is happening to someone
	// right now, while over-granting leaks money quietly and nobody is waiting.
	const order = { 'under-granting': 0, 'over-granting': 1, metadata: 2 } as const;
	const lines = [...report.drifted]
		.sort((a, b) => order[a.impact] - order[b.impact])
		.map((d) => {
			const who = `${d.subscriberType}:${d.subscriberId}`;
			if (!d.theirs) {
				return `${who} (${d.providerSubscriptionId}): we hold status '${d.ours.status}' but the provider has NO such subscription [${d.impact}]`;
			}
			const diffs = d.fields
				.map((f) => `${f} ours=${String(d.ours[f as keyof typeof d.ours])} theirs=${String(d.theirs![f as keyof typeof d.theirs])}`)
				.join(', ');
			return `${who} (${d.providerSubscriptionId}): ${diffs} [${d.impact}]`;
		});

	if (report.truncated) lines.push(`NOTE: ${report.truncated.note}`);
	return lines;
}
