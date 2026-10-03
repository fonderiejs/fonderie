import type { INormalizedInvoiceSummary } from '../providers/types';

// Keyset cursor for GET /billing/invoices. Invoices are listed newest first,
// ordered by (created DESC, id DESC); the cursor is the last row of a page.
// Provider ids (in_…, ch_…) are not UUIDs, so this is billing's own codec.

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const ID_RE = /^[A-Za-z0-9_]{1,128}$/;

export interface IInvoiceCursor {
	created: string;
	id: string;
}

export function encodeInvoiceCursor(row: { created: string; id: string }): string {
	return Buffer.from(JSON.stringify([row.created, row.id])).toString('base64url');
}

export function decodeInvoiceCursor(cursor: string): IInvoiceCursor | null {
	if (cursor.length > 256) return null;
	try {
		const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
		if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') {
			return null;
		}
		if (!TS_RE.test(parsed[0]) || Number.isNaN(Date.parse(parsed[0])) || !ID_RE.test(parsed[1])) {
			return null;
		}
		return { created: parsed[0], id: parsed[1] };
	} catch {
		return null;
	}
}

// Newest first; ties on `created` (second granularity at the provider) broken by
// id so the order — and therefore the cursor — is total.
export function compareInvoicesDesc(
	a: { created: string; id: string },
	b: { created: string; id: string },
): number {
	if (a.created !== b.created) return a.created < b.created ? 1 : -1;
	if (a.id !== b.id) return a.id < b.id ? 1 : -1;
	return 0;
}

/**
 * One page of the union of every source's invoices. Each source must have
 * been asked for `limit + 1` rows at or before the cursor, so "more than
 * `limit` rows after the cursor" is exactly "there is a next page".
 */
export function pageInvoices(
	sources: INormalizedInvoiceSummary[][],
	limit: number,
	cursor: IInvoiceCursor | null,
): { invoices: INormalizedInvoiceSummary[]; nextCursor: string | null } {
	const byId = new Map(sources.flat().map((inv) => [inv.id, inv]));
	const after = [...byId.values()]
		// Strictly past the cursor: a provider that ignores the bound returns
		// rows already shown, which this drops instead of repeating.
		.filter((inv) => !cursor || compareInvoicesDesc(inv, cursor) > 0)
		.sort(compareInvoicesDesc);
	const invoices = after.slice(0, limit);
	const last = invoices[invoices.length - 1];
	return {
		invoices,
		nextCursor: after.length > limit && last ? encodeInvoiceCursor(last) : null,
	};
}
