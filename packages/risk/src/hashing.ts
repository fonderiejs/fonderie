// The PII firewall in code: every correlating value is peppered-hashed before
// it touches the store, and IPs are bucketed so per-address rotation can't
// evade velocity. Nothing here is ever exported to analytics.
import { createHash } from 'node:crypto';

const PLACEHOLDER_PEPPERS = new Set(['change-me', 'dev-pepper', 'change-me-long-random-string']);

/** Resolve the pepper: a caller-supplied value wins; otherwise fall back to a
 * dev pepper OUTSIDE production and throw INSIDE it (a leaked store must not be
 * dictionary-attackable). */
export function resolvePepper(supplied?: string): string {
	const p = supplied ?? process.env.RISK_PEPPER;
	if (p && p.length >= 32 && !PLACEHOLDER_PEPPERS.has(p)) return p;
	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'@fonderie/risk: a unique pepper of >=32 chars is required in production ' +
				'(pass RiskEngine({ pepper }) or set RISK_PEPPER) — without it the hashed ' +
				'risk_events store is dictionary-attackable offline.',
		);
	}
	return 'fonderie-risk-dev-pepper-not-for-production';
}

/** sha256(pepper ‖ kind ‖ value) — domain-separated so a card hash can never
 * collide with an ip hash, peppered so a leaked table can't be reversed by
 * hashing candidate values. */
export function hashValue(pepper: string, kind: string, value: string): string {
	return createHash('sha256').update(`${pepper}\0${kind}\0${value}`).digest('hex');
}

/** IPv6 collapses to its /64 (the customary end-site prefix — the low 64 bits
 * rotate freely and would defeat per-address velocity); IPv4-mapped IPv6
 * resolves to its embedded IPv4; IPv4 passes through whole. */
export function ipBucket(ip: string): string {
	if (!ip.includes(':')) return ip;
	const [head] = ip.split('%');
	const v4Mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(head ?? '');
	if (v4Mapped) return v4Mapped[1] as string;
	const groups = (head ?? '').split('::');
	let left = groups[0] ? groups[0].split(':') : [];
	const right = groups[1] ? groups[1].split(':') : [];
	if (groups.length === 2) {
		const fill = 8 - left.length - right.length;
		left = [...left, ...Array<string>(Math.max(0, fill)).fill('0'), ...right];
	}
	return `${left.slice(0, 4).join(':')}::/64`;
}

/** Normalize a value for hashing by kind: IPs are bucketed, everything else is
 * lower-cased/trimmed so trivial spelling differences collapse. */
export function normalizeForKind(kind: string, value: string): string {
	if (kind === 'ip') return ipBucket(value.trim());
	return value.trim().toLowerCase();
}
