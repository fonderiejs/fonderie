import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

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

// Expand an IPv6 string to its 8 16-bit groups, or null if unparseable.
// Handles `::` compression, a zone id, and a trailing dotted-IPv4 tail
// (::ffff:1.2.3.4). Needed because attackers can embed an internal IPv4 in
// MANY notations — the previous check only matched the dotted mapped form and
// missed the hex-colon (::ffff:a9fe:a9fe), NAT64 and 6to4 embeddings, which
// the OS routes to the embedded IPv4 (e.g. 169.254.169.254 cloud metadata).
function expandV6(ip: string): number[] | null {
	let s = ip.toLowerCase().split('%')[0]!; // strip zone id
	// Convert a trailing dotted-quad to two hextets.
	const dot = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
	if (dot) {
		const q = dot[2]!.split('.').map(Number);
		if (q.some((n) => !Number.isInteger(n) || n > 255)) return null;
		s = `${dot[1]}${((q[0]! << 8) | q[1]!).toString(16)}:${((q[2]! << 8) | q[3]!).toString(16)}`;
	}
	const halves = s.split('::');
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(':') : [];
	let groups: string[];
	if (halves.length === 1) {
		groups = head;
	} else {
		const tail = halves[1] ? halves[1].split(':') : [];
		const missing = 8 - head.length - tail.length;
		if (missing < 0) return null;
		groups = [...head, ...Array(missing).fill('0'), ...tail];
	}
	if (groups.length !== 8) return null;
	const nums = groups.map((g) => (g === '' ? 0 : parseInt(g, 16)));
	if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
	return nums;
}

const isPrivateIPv6 = (ip: string): boolean => {
	const h = expandV6(ip);
	if (!h) return true; // unparseable → fail closed
	const [h0, h1, h2, h3, h4, h5, h6, h7] = h as [number, number, number, number, number, number, number, number];
	// Native IPv6 non-public ranges.
	if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && (h7 === 0 || h7 === 1))
		return true; // :: (unspecified) / ::1 (loopback)
	if ((h0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
	if ((h0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
	// Embedded-IPv4 forms — extract the 32-bit IPv4 and apply the v4 blocklist,
	// so an internal target is caught regardless of the wrapping notation.
	const asV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
	// ::ffff:0:0/96 (IPv4-mapped) and ::/96 (deprecated IPv4-compatible).
	if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && (h5 === 0xffff || h5 === 0))
		return isPrivateIPv4(asV4(h6, h7));
	// 64:ff9b::/96 (NAT64 well-known prefix).
	if (h0 === 0x0064 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0)
		return isPrivateIPv4(asV4(h6, h7));
	// 2002::/16 (6to4) — embedded IPv4 is in groups 1-2.
	if (h0 === 0x2002) return isPrivateIPv4(asV4(h1, h2));
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

/** A validated, public target plus the exact IP the socket must connect to. */
export interface IPinnedTarget {
	url: URL;
	ip: string;
	family: 4 | 6;
}

/**
 * Validate a webhook URL AND resolve it to a concrete public IP to connect to.
 * Same rejection rules as {@link assertPublicHttpUrl}, but returns the pinned
 * address so the caller can bind the socket to it — closing the DNS-rebinding
 * TOCTOU where the name re-resolves to an internal IP between the check and
 * the connect.
 */
export async function resolvePinnedTarget(raw: string): Promise<IPinnedTarget> {
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		throw new SsrfError('Invalid URL');
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') {
		throw new SsrfError(`Unsupported URL scheme: ${u.protocol}`);
	}
	const host = u.hostname.replace(/^\[|\]$/g, '');
	if (net.isIP(host)) {
		if (isBlockedAddress(host)) throw new SsrfError('URL points at a non-public address');
		return { url: u, ip: host, family: net.isIP(host) === 6 ? 6 : 4 };
	}
	let addrs: Array<{ address: string; family: number }>;
	try {
		addrs = await lookup(host, { all: true });
	} catch {
		throw new SsrfError('Webhook host did not resolve');
	}
	if (addrs.length === 0) throw new SsrfError('Webhook host did not resolve');
	// EVERY resolved address must be public (a rebinding host may return a mix);
	// pin to the first.
	for (const { address } of addrs) {
		if (isBlockedAddress(address)) throw new SsrfError('URL resolves to a non-public address');
	}
	const chosen = addrs[0]!;
	return { url: u, ip: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}

/** Normalized webhook delivery result — decoupled from any HTTP client. */
export interface IWebhookResponse {
	ok: boolean;
	status: number;
	body: string;
}

/** Delivery transport: send the request, return a normalized result. */
export type WebhookTransport = (
	url: string,
	init: { method: string; headers: Record<string, string>; body: string; timeoutMs?: number },
	maxResponseBytes?: number,
) => Promise<IWebhookResponse>;

/**
 * Read a response stream to text, stopping at maxBytes — the receiving
 * endpoint is caller-controlled, so its body must never be buffered
 * unbounded (memory + stored-row bloat). Exported for testing the cap.
 */
export async function readCappedText(
	stream: ReadableStream<Uint8Array> | null,
	maxBytes: number,
): Promise<string> {
	if (!stream) return '';
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		const room = maxBytes - total;
		if (value.byteLength >= room) {
			chunks.push(value.slice(0, room));
			total += room;
			await reader.cancel().catch(() => undefined);
			break;
		}
		chunks.push(value);
		total += value.byteLength;
	}
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		merged.set(c, offset);
		offset += c.byteLength;
	}
	return new TextDecoder().decode(merged);
}

/**
 * SSRF-safe delivery transport. Resolves + validates the URL, then PINS the
 * socket to the validated IP via an undici Agent whose connector always
 * returns that address — so a name that rebinds to an internal IP after the
 * check can never be connected to. TLS SNI / cert validation still use the
 * URL hostname (only the socket target is pinned), so HTTPS endpoints work.
 * Never follows redirects (a 3xx becomes a non-ok opaque response).
 */
export const pinnedTransport: WebhookTransport = async (url, init, maxResponseBytes = 4 * 1024) => {
	const target = await resolvePinnedTarget(url);
	const agent = new Agent({
		connect: {
			// Force the socket to the pre-validated address no matter what the
			// name resolves to now (closes the rebinding TOCTOU). Node's connect
			// path calls lookup with the dns.lookup contract — the modern
			// autoSelectFamily path passes `all: true` and expects an ARRAY
			// callback; the legacy path expects (err, address, family). Handle both.
			lookup(
				_hostname: string,
				opts: { all?: boolean | undefined },
				cb: (err: Error | null, addressOrList: string | Array<{ address: string; family: number }>, family?: number) => void,
			) {
				if (opts?.all) {
					cb(null, [{ address: target.ip, family: target.family }]);
				} else {
					cb(null, target.ip, target.family);
				}
			},
		},
	});
	try {
		const res = await undiciFetch(url, {
			method: init.method,
			headers: init.headers,
			body: init.body,
			redirect: 'manual',
			signal: AbortSignal.timeout(init.timeoutMs ?? 10_000),
			dispatcher: agent,
		});
		const body = await readCappedText(res.body as ReadableStream<Uint8Array> | null, maxResponseBytes).catch(() => '');
		return { ok: res.ok, status: res.status, body };
	} finally {
		await agent.close().catch(() => undefined);
	}
};
