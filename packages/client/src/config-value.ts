// Typed config values for admin UIs (and, later, feature-flag hooks).
//
// Config values are stored as JSON, so a stored `true` stays a boolean and `3`
// stays a number. What an editor needs on top is: which input to show for a
// value, and how to turn what the operator typed back into a typed value —
// with an explanation, not a silent failure, when it doesn't parse.

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json';

export const CONFIG_VALUE_TYPES: readonly ConfigValueType[] = ['string', 'number', 'boolean', 'json'];

/** The editor type for a stored value. Objects, arrays and null are JSON. */
export function configValueType(value: unknown): ConfigValueType {
	if (typeof value === 'string') return 'string';
	if (typeof value === 'number') return 'number';
	if (typeof value === 'boolean') return 'boolean';
	return 'json';
}

/** What an input should show for a stored value of that type. */
export function formatConfigValue(value: unknown, type: ConfigValueType = configValueType(value)): string {
	if (type === 'string') return typeof value === 'string' ? value : String(value ?? '');
	if (type === 'number') return typeof value === 'number' ? String(value) : '';
	if (type === 'boolean') return value === true ? 'true' : 'false';
	return JSON.stringify(value ?? null, null, 2);
}

export type CastResult = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Turn what an operator typed into the typed value to store.
 * - string: kept verbatim (an empty string is a valid value)
 * - number: finite numbers only — "1e3" and "-2.5" are fine, "12px" is not
 * - boolean: true/false, also 1/0, yes/no, on/off (case-insensitive)
 * - json: any valid JSON
 */
export function castConfigValue(type: ConfigValueType, raw: string): CastResult {
	if (type === 'string') return { ok: true, value: raw };
	const t = raw.trim();
	if (type === 'number') {
		if (t === '') return { ok: false, error: 'Enter a number.' };
		const n = Number(t);
		return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `"${raw}" is not a number.` };
	}
	if (type === 'boolean') {
		const v = t.toLowerCase();
		if (['true', '1', 'yes', 'on'].includes(v)) return { ok: true, value: true };
		if (['false', '0', 'no', 'off'].includes(v)) return { ok: true, value: false };
		return { ok: false, error: 'Use true or false.' };
	}
	try {
		return { ok: true, value: JSON.parse(t) };
	} catch (err) {
		return { ok: false, error: `Not valid JSON: ${(err as Error).message}` };
	}
}

/**
 * Config keys: letters, digits, `.`, `_`, `-`; must start with a letter; up to
 * 128 characters. Both styles work — `ENABLE_JOB_LISTING` and `feature.dark-mode`.
 */
export const CONFIG_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;

export function configKeyProblem(key: string): string | null {
	if (!key) return 'Enter a key.';
	return CONFIG_KEY_PATTERN.test(key)
		? null
		: 'Start with a letter; use letters, digits, ".", "_" or "-" (max 128).';
}
