import type { IFonderieContext } from '@fonderie/core';

import type { SubscriberType } from './types';

export interface ISubscriber {
	type: SubscriberType;
	id: string;
}

// Narrow a bigint money amount into a JS number for the wire-stable plan
// pricing DTO (bounded display cents). Loud failure beats silent corruption:
// a value past 2^53 would round, so refuse it instead.
export function moneyToNumber(amount: bigint): number {
	if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < -BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new Error(`[billing] amount ${amount} exceeds Number.MAX_SAFE_INTEGER`);
	}
	return Number(amount);
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
