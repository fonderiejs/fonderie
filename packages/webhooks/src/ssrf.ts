import { lookup } from 'node:dns/promises';
import net from 'node:net';

/** Thrown when a webhook URL is not a safe, public http(s) target. */
export class SsrfError extends Error {
	readonly fonderieSsrf = true as const;
}

const ipv4ToInt = (ip: string): number => {
	const p = ip.split('.').map(Number);
	return (((p[0]! << 24) >>> 0) + (p[1]! << 16) + (p[2]! << 8) + p[3]!) >>> 0;
};

// Non-public IPv4 blocks: this-host, private (RFC1918), CGNAT, loopback,
// link-local (incl. cloud metadata 169.254.169.254), benchmarking, TEST-NET,
// multicast, reserved, broadcast.
const BLOCKED_V4: Array<[string, number]> = [
	['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
	['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
	['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
	['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
];

const inCidr = (ipN: number, base: string, bits: number): boolean => {
	const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
	return ((ipN & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
};

const isPrivateIPv4 = (ip: string): boolean => {
	const n = ipv4ToInt(ip);
	return BLOCKED_V4.some(([base, bits]) => inCidr(n, base, bits));
};

const isPrivateIPv6 = (ip: string): boolean => {
	const a = ip.toLowerCase();
	if (a === '::1' || a === '::') return true; // loopback / unspecified
	if (a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb')) return true; // fe80::/10 link-local
	if (a.startsWith('fc') || a.startsWith('fd')) return true; // fc00::/7 unique-local
	const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(a); // IPv4-mapped
	if (mapped) return isPrivateIPv4(mapped[1]!);
	return false;
};

/** True when an IP string is loopback/private/link-local/reserved (or not a valid IP → fail closed). */
export const isBlockedAddress = (ip: string): boolean => {
	const v = net.isIP(ip);
	if (v === 4) return isPrivateIPv4(ip);
	if (v === 6) return isPrivateIPv6(ip);
	return true;
};

/**
 * Guard a user-supplied webhook URL against SSRF: reject non-http(s) schemes and
 * any host that resolves to a non-public address (loopback / RFC1918 / CGNAT /
 * link-local incl. cloud metadata / reserved). MUST be called at DELIVERY time,
 * not only at registration — DNS can change between the two. The dispatcher also
 * sends with `redirect: 'manual'`, so a public host can't 302 into an internal
 * one after this check. (A narrow DNS-rebinding TOCTOU between this lookup and
 * the socket connect remains; pinning the connection to the validated IP via a
 * custom dispatcher is the recommended hardening follow-up.)
 */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		throw new SsrfError('Invalid URL');
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') {
		throw new SsrfError(`Unsupported URL scheme: ${u.protocol}`);
	}
	const host = u.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
	if (net.isIP(host)) {
		if (isBlockedAddress(host)) throw new SsrfError('URL points at a non-public address');
		return;
	}
	let addrs: Array<{ address: string }>;
	try {
		addrs = await lookup(host, { all: true });
	} catch {
		throw new SsrfError('Webhook host did not resolve');
	}
	if (addrs.length === 0) throw new SsrfError('Webhook host did not resolve');
	for (const { address } of addrs) {
		if (isBlockedAddress(address)) throw new SsrfError('URL resolves to a non-public address');
	}
}
