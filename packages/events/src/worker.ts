import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

import type { EventBus } from './bus';

/**
 * Run a queue consumer that works on every hosting shape.
 *
 * Fonderie already solves the durable half — the outbox, exclusive claiming,
 * the visibility lease, retries, dead-lettering. What it left to each app was
 * the last mile: WHERE the consumer runs. That question has three different
 * answers depending on the platform, and an app that hardcodes one is locked
 * to it:
 *
 *   • always-on container (a VPS, Railway, Render, a box you own)
 *       → nothing triggers it, so it must drain on its own schedule
 *   • scale-to-zero service (Cloud Run, Fly)
 *       → the platform wakes it with an HTTP REQUEST, so it must serve one,
 *         or it can never scale to zero and the cheap tier is unusable
 *   • run-once job (Cloud Run Jobs, a Kubernetes CronJob, GitHub Actions)
 *       → it must drain and EXIT, or the job never completes
 *
 * This handles all three from one entrypoint, so the same image deploys
 * anywhere and the hosting decision stays reversible — which is the point.
 * Picking a provider should not be a code change.
 *
 * It also removes a trap. A consumer built on `start()` holds a LISTEN
 * connection, which a transaction-mode pooler rejects outright, so it needs a
 * different connection string from the API that publishes to it. A worker that
 * drains instead needs no LISTEN and can reuse the app's existing URL.
 *
 * @example Always-on container — drains every 30s, no trigger needed.
 *   await runWorker(bus);
 *
 * @example Scale-to-zero — the platform's request wakes it.
 *   await runWorker(bus, { port: Number(process.env.PORT), secret: process.env.WORKER_SECRET });
 *
 * @example Run-once job — drain, then exit.
 *   await runWorker(bus, { once: true });
 */
export interface IRunWorkerOptions {
	/**
	 * Drain at most this long per pass. Keep it under the platform's request
	 * timeout when serving HTTP, or the wake request is killed mid-drain and the
	 * platform records a failure for work that was proceeding fine.
	 */
	maxMs?: number;

	/**
	 * Timer fallback, ms. This is what makes an always-on host work with no
	 * trigger at all. Set 0 to disable when something else drives the drain
	 * (a platform scheduler, or a transport already running its own poll loop).
	 * Default 30_000.
	 */
	intervalMs?: number;

	/**
	 * Serve `GET /health` and `POST /drain` on this port. Required for
	 * scale-to-zero: those platforms only start a stopped instance for an
	 * incoming request, so without a listener the instance can never wake and
	 * must be left running. Omit to run with no HTTP at all.
	 */
	port?: number;

	/**
	 * Shared secret for `POST /drain`, compared in constant time. REQUIRED when
	 * `port` is set: an unauthenticated drain endpoint is a public "do work"
	 * button, and the drain is the expensive half of the system.
	 */
	secret?: string;

	/** Drain once, then resolve. For run-once job platforms. */
	once?: boolean;

	/** Called on a failed drain. Default logs; a drain must never kill the process. */
	onError?: (err: unknown) => void;
}

function secretsMatch(provided: string, expected: string): boolean {
	// timingSafeEqual throws on length mismatch, which would itself leak length.
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export interface IWorkerHandle {
	/** Resolves once the worker has stopped. */
	readonly done: Promise<void>;
	/** Stop accepting work, finish what is in flight, release the transport. */
	stop(): Promise<void>;
	/**
	 * The port actually bound, or undefined when no server was started. Worth
	 * reading when `port: 0` asked the OS to choose — and worth logging, so a
	 * deploy's logs say where the wake endpoint is.
	 */
	readonly port?: number;
}

/**
 * Accepts SEVERAL buses because a worker process usually owns more than one
 * consumer — a job queue and a notification queue, say. Draining only one of
 * them leaves the others LISTENing, which silently defeats `once`: the work is
 * done but the process never exits, and a job platform records a timeout for a
 * run that actually succeeded.
 */
// `server.close()` stops ACCEPTING connections; it does not settle until every
// existing one has ended. An HTTP/1.1 keep-alive socket is "existing" while it
// sits idle, so a client that made one request and kept the connection warm
// holds the callback open indefinitely — and with it the listening handle, the
// `stop()` promise, and the process.
//
// That is a hang with no error and no output: the suite prints `fail 0`, the
// runner never exits, and whatever supervises it waits forever. In CI the
// handle dump caught exactly this shape in worker.test.ts —
// `active: {"PipeWrap":2,"TCPServerWrap":1}` — a listening server outliving a
// test that does call stop(). It does not reproduce on a developer machine,
// because whether undici has already dropped the socket is a timing race.
//
// closeIdleConnections() releases the keep-alives, which is the common case and
// costs nothing in flight. The deadline then covers the rest: a graceful close
// is attempted first, and anything still attached after it is severed rather
// than allowed to hang shutdown forever. Shutdown that cannot finish is worse
// than a request that does not.
// How long stop() waits for a pass in flight before abandoning it. Long enough
// for a normal drain to finish, short enough that shutdown always completes.
const STOP_GRACE_MS = 10_000;

// Resolve when `work` does, or when the deadline passes — whichever is first.
// The timer is unref'd so it can never be the thing keeping a process alive.
async function withDeadline(work: Promise<unknown> | undefined, ms: number): Promise<void> {
	if (!work) return;
	let timer: ReturnType<typeof setTimeout> | undefined;
	await Promise.race([
		work,
		new Promise<void>((resolve) => {
			timer = setTimeout(resolve, ms);
			timer.unref?.();
		}),
	]);
	if (timer) clearTimeout(timer);
}

const CLOSE_GRACE_MS = 5_000;

async function closeServer(server: Server): Promise<void> {
	server.closeIdleConnections();
	const closed = new Promise<void>((resolve) => server.close(() => resolve()));
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<'timeout'>((resolve) => {
		timer = setTimeout(() => resolve('timeout'), CLOSE_GRACE_MS);
		timer.unref?.();
	});
	if ((await Promise.race([closed.then(() => 'closed' as const), deadline])) === 'timeout') {
		server.closeAllConnections();
		await closed;
	}
	if (timer) clearTimeout(timer);
}

export async function runWorker(
	buses: EventBus | EventBus[],
	options: IRunWorkerOptions = {},
): Promise<IWorkerHandle> {
	const all = Array.isArray(buses) ? buses : [buses];
	const {
		maxMs = 25_000,
		intervalMs = 30_000,
		port,
		secret,
		once = false,
		onError = (err: unknown) => console.error('[worker] drain failed:', err),
	} = options;

	if (port !== undefined && !secret) {
		// Fail at boot rather than serving an open endpoint. A misconfigured
		// deploy should not silently become a public trigger.
		throw new Error('runWorker: `secret` is required when `port` is set — an unguarded /drain is a public "do work" button');
	}

	for (const b of all) await b.start();

	if (once) {
		try {
			await Promise.all(all.map((b) => b.drain({ maxMs })));
		} catch (err) {
			onError(err);
		}
		for (const b of all) await b.stop();
		return { done: Promise.resolve(), stop: async () => {} };
	}

	let stopping = false;
	// One drain at a time within a process. Several wake requests can land on
	// one instance, and overlapping drains would have each claim rows the other
	// is working — correctness still holds (claiming is exclusive), but the
	// instance does redundant work and holds more connections than it needs.
	let inFlight: Promise<void> | null = null;
	// A wake that arrives DURING a drain must not be dropped: the work it is
	// about may have been published after the running pass started scanning.
	let again = false;

	const drainOnce = async (): Promise<void> => {
		if (stopping) return;
		if (inFlight) {
			again = true;
			return inFlight;
		}
		inFlight = (async () => {
			try {
				do {
					again = false;
					await Promise.all(all.map((b) => b.drain({ maxMs })));
				} while (again && !stopping);
			} catch (err) {
				onError(err);
			} finally {
				inFlight = null;
			}
		})();
		return inFlight;
	};

	const timer = intervalMs > 0 ? setInterval(() => void drainOnce(), intervalMs) : null;
	timer?.unref?.();

	const server = port === undefined
		? null
		: createServer((req: IncomingMessage, res: ServerResponse) => {
				const url = req.url ?? '/';
				if (req.method === 'GET' && (url === '/health' || url === '/')) {
					res.writeHead(200, { 'content-type': 'application/json' });
					res.end(JSON.stringify({ ok: true, draining: inFlight !== null }));
					return;
				}
				if (req.method === 'POST' && url === '/drain') {
					const header = req.headers.authorization ?? '';
					const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
					if (!secretsMatch(provided, secret!)) {
						res.writeHead(401, { 'content-type': 'application/json' });
						res.end(JSON.stringify({ error: 'unauthorized' }));
						return;
					}
					// Answer once the drain finishes, so a caller that wants to know
					// the work happened can wait — and so a platform billing by
					// request duration is not charged for a fire-and-forget that
					// outlives its own response.
					void drainOnce().then(
						() => {
							res.writeHead(200, { 'content-type': 'application/json' });
							res.end(JSON.stringify({ ok: true }));
						},
						() => {
							res.writeHead(500, { 'content-type': 'application/json' });
							res.end(JSON.stringify({ ok: false }));
						},
					);
					return;
				}
				res.writeHead(404, { 'content-type': 'application/json' });
				res.end(JSON.stringify({ error: 'not found' }));
			});

	let boundPort: number | undefined;
	if (server && port !== undefined) {
		await new Promise<void>((resolve) => server.listen(port, () => resolve()));
		const addr = server.address();
		boundPort = typeof addr === 'object' && addr ? addr.port : port;
	}

	// Drain immediately on boot. A container that starts with a backlog should
	// not wait out a full interval before touching it — and on a run-once
	// platform that first pass may be the only one.
	void drainOnce();

	let resolveDone: () => void;
	const done = new Promise<void>((r) => { resolveDone = r; });

	const stop = async (): Promise<void> => {
		if (stopping) return done;
		stopping = true;
		if (timer) clearInterval(timer);
		// Finish the pass in flight. A scale-to-zero platform SIGTERMs routinely,
		// so abandoning mid-drain is the normal case, not an edge one: the rows
		// would stay 'processing' until their lease expires, delaying delivery
		// for no reason.
		//
		// BOUNDED, because this await used to be unconditional and a drain that
		// never settles — a query against a pooler that has gone away, a handler
		// waiting on a promise nobody resolves — froze stop() here, BEFORE the
		// server was closed. The listening handle then kept the process alive
		// with no error and no output.
		//
		// That is the CI hang. The dump from a hung run showed this exact
		// signature in worker.test.ts, `{"PipeWrap":2,"TCPServerWrap":1}`, and a
		// stalled drain reproduces it byte for byte. Waiting for the pass is a
		// courtesy to rows that would otherwise sit in 'processing'; it is not
		// worth never shutting down for, and the lease already covers the case.
		await withDeadline(inFlight?.catch(() => {}), STOP_GRACE_MS);
		if (server) await closeServer(server);
		for (const b of all) await b.stop();
		resolveDone();
		return done;
	};

	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void stop().then(() => process.exit(0));
		});
	}

	return boundPort === undefined ? { done, stop } : { done, stop, port: boundPort };
}
