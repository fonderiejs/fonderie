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
//
// ⚠️ THE PROXY FOOTGUN. With trustProxy=0 (the spoof-safe default) deployed
// behind nginx, a Kubernetes ingress, or any L7 proxy, the socket address is
// the PROXY's IP for every request — so every client collapses onto one
// per-IP bucket and the limit becomes global (one attacker locks everyone
// out). You cannot have a default that is both spoof-safe AND correct behind
// a proxy; they contradict. So we ship spoof-safe and DETECT the mismatch:
// checkProxyConfig() below warns once, loudly, when the deployment looks
// proxied but trustProxy is unset. Set TRUST_PROXY=<hops> in that case.

export function resolveClientIp(
	socketAddress: string | undefined,
	headers: Headers,
	trustProxy: number = trustProxyFromEnv(),
): string | undefined {
	if (trustProxy > 0) {
		const xff = headers.get('x-forwarded-for');
		if (xff) {
			const hops = xff
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			const candidate = hops[Math.max(0, hops.length - trustProxy)];
			if (candidate) return normalizeIp(candidate);
		}
	}
	checkProxyConfig(socketAddress, headers, trustProxy);
	return socketAddress ? normalizeIp(socketAddress) : undefined;
}

function trustProxyFromEnv(): number {
	const raw = Number(process.env['TRUST_PROXY']);
	return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function normalizeIp(ip: string): string {
	// ::ffff:203.0.113.7 → 203.0.113.7 ; strip port if a proxy appended one
	const noV6Prefix = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
	const m = noV6Prefix.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
	return m ? m[1]! : noV6Prefix;
}

function isPrivateOrLoopback(ip: string): boolean {
	const a = normalizeIp(ip);
	return (
		a === '127.0.0.1' ||
		a === '::1' ||
		a.startsWith('10.') ||
		a.startsWith('192.168.') ||
		a.startsWith('169.254.') || // link-local
		a.startsWith('fc') ||
		a.startsWith('fd') || // IPv6 ULA
		/^172\.(1[6-9]|2\d|3[01])\./.test(a) // 172.16.0.0/12
	);
}

let warned = false;

// Warn ONCE when the deployment looks proxied (forwarding header present, and
// the socket is a private/loopback address — i.e. a local proxy) but
// trustProxy is unset. That configuration silently rate-limits every client
// as one IP. Emitting on the request path (not at boot) is deliberate: the
// signal we need — an actual X-Forwarded-For header — only exists once real
// traffic arrives.
export function checkProxyConfig(
	socketAddress: string | undefined,
	headers: Headers,
	trustProxy: number,
): void {
	if (warned || trustProxy > 0) return;
	const forwarded =
		headers.get('x-forwarded-for') ??
		headers.get('cf-connecting-ip') ??
		headers.get('x-real-ip');
	if (forwarded && socketAddress && isPrivateOrLoopback(socketAddress)) {
		warned = true;
		console.warn(
			'[fonderie] Requests carry a forwarding header (X-Forwarded-For) and ' +
				'arrive from a private/loopback socket, but TRUST_PROXY is unset. ' +
				'Every client is being rate-limited as a single IP, which will cause ' +
				'global lockout behind nginx / a Kubernetes ingress / any L7 proxy. ' +
				'Set TRUST_PROXY=<number of trusted proxy hops>. ' +
				'See @fonderie/rate-limit README § Deploying behind a proxy.',
		);
	}
}

// Test seam — reset the once-only warning latch.
export function _resetProxyWarning(): void {
	warned = false;
}
