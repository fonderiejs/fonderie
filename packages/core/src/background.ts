// Work dispatched off the request path — notification emails, webhook
// deliveries, domain events. On a long-running host a detached promise simply
// finishes in the background. On serverless it does NOT: the instance is
// frozen the moment the response is written, so the work is abandoned
// mid-flight. The user is told "check your email" and nothing is ever sent,
// with no error anywhere, because the code that would have logged it never ran.

export type BackgroundMode = 'auto' | 'await' | 'detach';

/**
 * Environment markers that mean "this process is frozen between requests".
 *
 * Deliberately a positive list of SERVERLESS platforms rather than an attempt
 * to detect long-running ones: there is no reliable signal for "this process
 * outlives the response", so EC2 / Docker / bare metal are the FALLBACK and
 * can never be misdetected. An unknown serverless platform behaves exactly as
 * it does today until it is added here — or until the deployment sets
 * FONDERIE_BACKGROUND_TASKS=await.
 */
const SERVERLESS_MARKERS = [
	'VERCEL', // Vercel
	'AWS_LAMBDA_FUNCTION_NAME', // AWS Lambda, Netlify Functions
	'FUNCTION_TARGET', // Google Cloud Functions
	'K_SERVICE', // Google Cloud Run (CPU is throttled outside a request)
	'FUNCTIONS_WORKER_RUNTIME', // Azure Functions
];

export function isServerlessRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
	return SERVERLESS_MARKERS.some((key) => !!env[key]);
}

export function resolveBackgroundMode(env: NodeJS.ProcessEnv = process.env): 'await' | 'detach' {
	const configured = (env['FONDERIE_BACKGROUND_TASKS'] ?? 'auto').trim().toLowerCase();
	if (configured === 'await' || configured === 'detach') return configured;
	return isServerlessRuntime(env) ? 'await' : 'detach';
}

function resolveTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
	const raw = Number(env['FONDERIE_BACKGROUND_TIMEOUT_MS']);
	return Number.isFinite(raw) && raw > 0 ? raw : 5000;
}

// A platform-provided "keep the instance alive until this settles" — Vercel's
// waitUntil and its equivalents. Strictly better than awaiting, because the
// work completes WITHOUT delaying the response. An adapter or app wires it
// once at boot; when present it wins over both modes.
let runner: ((work: Promise<unknown>) => void) | null = null;

export function setBackgroundRunner(fn: ((work: Promise<unknown>) => void) | null): void {
	runner = fn;
}

/**
 * Hand off work that must not block the response but must still complete.
 *
 * Callers `await` this. In detach mode that resolves immediately (today's
 * behaviour, no added latency); in await mode it waits for the work, bounded
 * by a timeout so a hung provider degrades to "the email was lost" rather than
 * "signup hangs". Rejections are swallowed either way — background work must
 * never fail the request that triggered it.
 */
export async function background(work: Promise<unknown> | undefined): Promise<void> {
	if (!work) return;
	const settled = Promise.resolve(work).catch(() => undefined);

	if (runner) {
		runner(settled);
		return;
	}
	if (resolveBackgroundMode() === 'detach') return;

	let timer: ReturnType<typeof setTimeout> | undefined;
	await Promise.race([
		settled,
		new Promise<void>((resolve) => {
			// NOT unref'd: when the work never settles, this timer is the only
			// thing keeping the loop alive, and an unref'd one lets the process
			// drain before it fires — so the bound silently would not exist.
			// The clearTimeout below is what keeps it from holding a
			// long-running host open once the work wins the race.
			timer = setTimeout(resolve, resolveTimeoutMs());
		}),
	]);
	if (timer) clearTimeout(timer);
}
