import { createHmac, timingSafeEqual } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

// Tamper-evidence for the append-only event log. Each row carries an HMAC-SHA256
// over its immutable content, keyed by a server-held secret. An auditor (or a
// scheduled job) re-derives every HMAC and compares: any modified or forged row
// fails, because rewriting it without the key can't produce a matching HMAC.
//
// Scope: this detects *content* tampering and forged rows. It does not by itself
// prove no whole row was deleted — that is the job of append-only grants,
// restricted DB permissions, and backups. Kept deliberately keyed-per-row (not a
// prev-hash chain) so publishing stays lock-free on the hot event-bus path.

// Deterministic JSON: recursively sort object keys so the same logical value
// always serialises identically, regardless of insertion order or a JSONB
// round-trip through Postgres.
export function canonicalize(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(value as Record<string, unknown>).sort()) {
			out[k] = sortKeys((value as Record<string, unknown>)[k]);
		}
		return out;
	}
	return value;
}

export interface IHashableEvent {
	id: string;
	type: string;
	payload: unknown;
	meta: unknown;
}

// The HMAC over an event's immutable fields. Field separators (\n) are safe
// because they can't appear unescaped inside a JSON string or a UUID/type.
export function computeEventHmac(key: string, event: IHashableEvent): string {
	return createHmac('sha256', key)
		.update(event.id)
		.update('\n')
		.update(event.type)
		.update('\n')
		.update(canonicalize(event.payload))
		.update('\n')
		.update(canonicalize(event.meta))
		.digest('hex');
}

function hmacEquals(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export interface IIntegrityReport {
	// True when every HMAC-carrying row verified.
	ok: boolean;
	// Rows that carried an HMAC and were checked.
	checked: number;
	// Rows with no HMAC (published before integrity was enabled) — skipped.
	unprotected: number;
	// Ids of rows whose stored HMAC did not match a fresh computation.
	tampered: string[];
}

interface IRawEventRow {
	id: string;
	type: string;
	payload: unknown;
	meta: unknown;
	hmac: string | null;
}

// Walk the whole event log and re-verify every HMAC-carrying row. Intended for a
// scheduled integrity job or an on-demand audit endpoint.
export async function verifyEventChain(store: IStoreAdapter, key: string): Promise<IIntegrityReport> {
	const rows = await store.query<IRawEventRow>(
		`SELECT id, type, payload, meta, hmac FROM fonderie_events ORDER BY created_at, id`,
	);

	const report: IIntegrityReport = { ok: true, checked: 0, unprotected: 0, tampered: [] };

	for (const row of rows) {
		if (row.hmac === null) {
			report.unprotected += 1;
			continue;
		}
		report.checked += 1;
		const expected = computeEventHmac(key, row);
		if (!hmacEquals(expected, row.hmac)) {
			report.ok = false;
			report.tampered.push(row.id);
		}
	}

	return report;
}
