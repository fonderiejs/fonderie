// "Is this the same person's address" — the rule @fonderie/auth stores
// accounts under (normalizeEmail: trim, lowercase, drop a '+tag'). Kept here
// rather than imported because auth is not a runtime dependency of this brick;
// src/__tests__/email-key.test.ts fails if the two ever disagree.

/** The account key for a typed address, or null when it is not one. */
export function emailKey(email: string | null | undefined): string | null {
	if (typeof email !== 'string') return null;
	const lower = email.trim().toLowerCase();
	const at = lower.indexOf('@');
	if (at < 1 || at !== lower.lastIndexOf('@') || at === lower.length - 1) return null;
	const local = lower.slice(0, at);
	const plus = local.indexOf('+');
	const base = plus === -1 ? local : local.slice(0, plus);
	return base ? `${base}@${lower.slice(at + 1)}` : null;
}

/** Whether two typed addresses reach the same account (an invalid one never matches). */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
	const x = emailKey(a);
	return x !== null && x === emailKey(b);
}
