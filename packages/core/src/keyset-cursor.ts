// One opaque keyset-pagination cursor over (created_at, id) — used by billing's
// wallet ledger and audit's event log (previously two copies that had drifted:
// audit's decode skipped field-range checks, so a crafted cursor reached the
// ::timestamptz cast as a 500 instead of decoding to null → 422). Pure: no DB.
export function encodeKeysetCursor(createdAt: string, id: string): string {
	return Buffer.from(JSON.stringify([createdAt, id])).toString('base64url');
}

// Range-checked (month 01-12, day 01-31, hour 00-23, min/sec 00-59) so a crafted
// in-shape-but-out-of-range timestamp yields null (→ the caller's 422), never a
// Postgres cast error (500). Accepts Postgres' own text form
// ('2026-09-04 18:50:50.888123+00') so cursors survive round-trips without JS
// millisecond truncation.
const CURSOR_TS_RE =
	/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ]([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;
const CURSOR_ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function decodeKeysetCursor(cursor: string): { createdAt: string; id: string } | null {
	if (cursor.length > 256) return null;
	try {
		const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
		if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') {
			return null;
		}
		if (!CURSOR_TS_RE.test(parsed[0]) || !CURSOR_ID_RE.test(parsed[1])) return null;
		return { createdAt: parsed[0], id: parsed[1] };
	} catch {
		return null;
	}
}
