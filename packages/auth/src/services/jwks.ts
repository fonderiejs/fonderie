import { createPublicKey, type KeyObject } from 'node:crypto';

// An identity provider's published signing keys (Apple, Google), cached.
//
// Native sign-in tokens did NOT come from our own TLS exchange with the
// provider, so their signature is the only thing between a forged token and a
// login — and the attacker fully controls the (unverified) `kid` header. A
// naive "refetch on unknown kid" turns every forged token into an outbound
// call to the provider. So a refetch is:
//   (a) single-flighted — concurrent callers share one fetch,
//   (b) rate-limited — at most one attempt per minute, however many unknown
//       kids arrive,
//   (c) bounded by a timeout — a slow provider never ties up handlers.
// The keys are public, so a module-level cache is safe.

interface IJwk {
	kid: string;
	kty: string;
	n: string;
	e: string;
	alg?: string;
	use?: string;
}

export interface IJwksSource {
	/** The public key for `kid`, or null when the provider does not publish it. */
	getKey(kid: string): Promise<KeyObject | null>;
	/** Test-only: forget the cache and the rate-limit clock. */
	reset(): void;
}

const TTL_MS = 60 * 60 * 1000;
const MIN_REFETCH_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

export function createJwksSource(url: string): IJwksSource {
	let cache: { keys: IJwk[]; fetchedAt: number } | null = null;
	let inflight: Promise<void> | null = null;
	let lastAttempt = 0;

	const refresh = (): Promise<void> => {
		if (inflight) return inflight;
		lastAttempt = Date.now();
		inflight = (async () => {
			try {
				const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
				const data = (await res.json()) as { keys?: IJwk[] };
				if (Array.isArray(data.keys)) cache = { keys: data.keys, fetchedAt: Date.now() };
			} catch {
				// Keep any stale cache rather than failing outright.
			} finally {
				inflight = null;
			}
		})();
		return inflight;
	};

	return {
		async getKey(kid) {
			const find = () => cache?.keys.find((k) => k.kid === kid) ?? null;
			const fresh = () => !!cache && Date.now() - cache.fetchedAt < TTL_MS;
			let jwk = find();
			if ((!jwk || !fresh()) && Date.now() - lastAttempt >= MIN_REFETCH_MS) {
				await refresh();
				jwk = find();
			}
			if (!jwk) return null;
			try {
				return createPublicKey({ key: jwk as unknown as JsonWebKey, format: 'jwk' });
			} catch {
				return null;
			}
		},
		reset() {
			cache = null;
			inflight = null;
			lastAttempt = 0;
		},
	};
}
