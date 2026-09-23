// Names what is keeping a test process alive after it should have exited.
//
// The failure this exists for: `npm test` finishes — every suite prints
// `fail 0` — and then turbo waits forever on one child that never exits. It
// presents as "CI is slow", the job idles to its timeout, and the test output
// says nothing is wrong. It has cost six release cycles. One cause was found
// and fixed (a leaked pg.Pool in rate-limit's integration test, PR #415); the
// hang recurred afterwards, so at least one more remains.
//
// Why a timer and not `beforeExit`: `beforeExit` fires when the event loop is
// EMPTY, which is precisely the case that is NOT happening here. A process held
// open by a socket or a pool never reaches it. An unref'd timer is the inverse
// — it fires only if the process is still alive at the deadline, and because it
// is unref'd it cannot itself be the thing keeping it alive.
//
// Wired in CI only, via NODE_OPTIONS on the test step, so it applies to every
// spawned test process without touching 40 package scripts, and never runs on a
// developer machine or in a consumer's install.

const DEADLINE_MS = Number(process.env['FONDERIE_HANDLE_DUMP_MS'] ?? 90_000);

const timer = setTimeout(() => {
	// getActiveResourcesInfo returns coarse type names ('TCPSocketWrap',
	// 'Timeout', 'TCPWRAP'…) — enough to tell a lingering socket from a timer,
	// which is the distinction that decides where to look next.
	const resources = process.getActiveResourcesInfo?.() ?? ['(unavailable)'];
	const counts = resources.reduce((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});

	process.stderr.write(
		`\n[handles] STILL ALIVE after ${DEADLINE_MS}ms — this process is what turbo is waiting on.\n` +
			`[handles] argv: ${process.argv.join(' ')}\n` +
			`[handles] cwd:  ${process.cwd()}\n` +
			`[handles] active: ${JSON.stringify(counts)}\n` +
			`[handles] a socket or pool ⇒ an unclosed client; a Timeout ⇒ an interval never stopped.\n\n`,
	);
}, DEADLINE_MS);

// Must not keep the process alive itself, or this tool becomes the bug.
timer.unref();
