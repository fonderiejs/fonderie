// Client-IP resolution shared by the adapters. The web-standard Request the
// pipeline runs on carries no socket address, so each adapter passes the
// socket's remote address here together with the headers; this resolves the
// effective client IP with explicit proxy trust.
//
// trustProxy semantics (deliberately explicit — a permissive default lets
// any client spoof X-Forwarded-For and dodge per-IP rate limits):
//   0 / undefined → ignore forwarding headers; the socket address is the client
//   N > 0         → the client is the Nth-from-the-right entry in
//                   X-Forwarded-For (N = number of trusted proxy hops)

export function resolveClientIp(
	socketAddress: string | undefined,
	headers: Headers,
	trustProxy: number = Number(process.env['TRUST_PROXY']) || 0,
): string | undefined {
	if (trustProxy > 0) {
		const xff = headers.get('x-forwarded-for');
		if (xff) {
			const hops = xff.split(',').map((s) => s.trim()).filter(Boolean);
			const candidate = hops[Math.max(0, hops.length - trustProxy)];
			if (candidate) return normalizeIp(candidate);
		}
	}
	return socketAddress ? normalizeIp(socketAddress) : undefined;
}

function normalizeIp(ip: string): string {
	// ::ffff:203.0.113.7 → 203.0.113.7 ; strip port if a proxy appended one
	const noV6Prefix = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
	const m = noV6Prefix.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
	return m ? m[1]! : noV6Prefix;
}
