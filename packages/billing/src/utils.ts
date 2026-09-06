import type { IFonderieContext } from '@fonderie/core';

import type { SubscriberType } from './types';

export interface ISubscriber {
	type: SubscriberType;
	id: string;
}

// Common subscriber fields for a billing domain event. A top-level
// workspaceId is what @fonderie/webhooks fans out on, so workspace
// subscribers get one and user subscribers don't (a user-level billing event
// is not a workspace webhook, but in-process subscribers still receive it).
export function subscriberEventFields(
	subscriberType: SubscriberType,
	subscriberId: string,
): { subscriberType: SubscriberType; subscriberId: string; workspaceId?: string } {
	return {
		subscriberType,
		subscriberId,
		...(subscriberType === 'workspace' ? { workspaceId: subscriberId } : {}),
	};
}

// Narrow a bigint into a JS number, refusing values past 2^53 — loud failure
// beats silent rounding. Used where a BOUNDED amount meets a number-typed
// boundary (the wire-stable plan pricing DTO, the Stripe SDK). Deliberately
// not named after money: wallet balances are unbounded and must stay bigint —
// this is a narrowing tool, not a blessed money-to-number escape hatch.
export function toSafeNumber(amount: bigint): number {
	if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < -BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new Error(`[billing] amount ${amount} exceeds Number.MAX_SAFE_INTEGER`);
	}
	return Number(amount);
}

// Format a smallest-unit wallet amount into a human display string for a
// customer notification — courier's render() does pure {{var}} substitution
// with no formatting, so notices carry a pre-formatted `*Display` field
// alongside the raw value. `precision` is the wallet's configured decimal
// places (smallest unit = 10^-precision of the major unit; default 2).
//
// Currency-format via Intl (USD → "$19.99", JPY → "¥500" at precision 0, and
// code-symbol currencies like CHF/SEK → "CHF 5.00"). If the code isn't a
// well-formed currency (e.g. a credits wallet's 'CREDITS'), Intl throws and we
// fall back to the bare major-unit number. Never throws: an out-of-range amount
// or a bad code degrades to a plain string rather than break the
// (fire-and-forget) notification.
//
// We deliberately do NOT try to strip the currency label for "credits" wallets:
// there's no reliable way to tell a non-ISO 3-letter credits code (CRD) from a
// real ISO currency whose en-US symbol IS its code (CHF, SEK, …) by inspecting
// the output, and dropping the label from real currencies is worse than
// carrying a code. A credits app that wants a bare unit overrides the template.
export function formatWalletAmount(amount: bigint, currency: string, precision = 2): string {
	const cur = normalizeCurrency(currency);
	let major: number;
	try {
		major = toSafeNumber(amount) / 10 ** precision;
	} catch {
		return amount.toString(); // unbounded balance past 2^53 — show the raw integer
	}
	try {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: cur,
			minimumFractionDigits: precision,
			maximumFractionDigits: precision,
		}).format(major);
	} catch {
		return precision > 0 ? major.toFixed(precision) : major.toString();
	}
}

// One canonical form for wallet currency codes. Balances are keyed by the
// literal string — a lowercase 'usd' or a padded 'USD ' would open a second,
// unreachable bucket next to 'USD', so every boundary (config, schema, query
// param, webhook metadata) normalizes through here. Trim + case only:
// interior garbage ('U SD') is NOT repaired — write boundaries reject it
// instead, because silently guessing at a money-bucket key hides caller bugs.
export function normalizeCurrency(currency: string): string {
	return currency.trim().toUpperCase();
}

// Converts window strings like '1d', '30d', '1h' to milliseconds.
export function parseWindowMs(window: string): number {
	const n = parseInt(window, 10);
	const unit = window.slice(String(n).length);
	switch (unit) {
		case 'h':
			return n * 3_600_000;
		case 'd':
			return n * 86_400_000;
		case 'm':
			return n * 60_000;
		default:
			throw new Error(`Unknown window unit: '${unit}' in '${window}'`);
	}
}

// Resolves billing subscriber from request context.
// Precedence: X-Workspace-ID header → ctx.workspace (set by withWorkspace) → ctx.user
export function resolveSubscriber(ctx: IFonderieContext): ISubscriber | null {
	const wsFromHeader = ctx.request.headers.get('x-workspace-id');

	if (wsFromHeader) {
		return {
			type: 'workspace',
			id: wsFromHeader,
		};
	}

	if (ctx.workspace?.id) {
		return {
			type: 'workspace',
			id: ctx.workspace.id,
		};
	}

	if (ctx.user?.id) {
		return {
			type: 'user',
			id: ctx.user.id,
		};
	}

	return null;
}
