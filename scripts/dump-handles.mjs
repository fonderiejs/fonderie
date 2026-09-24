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

import { execSync } from 'node:child_process';

const DEADLINE_MS = Number(process.env['FONDERIE_HANDLE_DUMP_MS'] ?? 90_000);

// GNU procps first (the CI runner), BSD second (a developer's mac), so this can
// be exercised locally instead of debugged for the first time in the CI run it
// exists to explain. `etimes` is GNU-only seconds; `etime` is BSD's clock form.
const PS_VARIANTS = [
	'ps -eo pid,ppid,stat,etimes,args --no-headers',
	'ps -eo pid,ppid,stat,etime,args',
];

function processTree() {
	for (const cmd of PS_VARIANTS) {
		try {
			const raw = execSync(cmd, { encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'ignore'] });
			const all = raw
				.split('\n')
				.map((l) => l.trim())
				.filter((l) => l && !/^PID\b/i.test(l));

			// Seed on the names we expect...
			const NAMES = /node|npm|turbo|tsx|esbuild|postgres|redis|sh -c/;
			const seed = all.filter((l) => NAMES.test(l));
			const pids = new Set(seed.map((l) => l.split(/\s+/)[0]));

			// ...then pull in ANY child of one, whatever it is called. A
			// name-only filter hides exactly the process this hunt is for: the
			// suspect is a non-node holder (esbuild ships a Go binary), and a
			// local run of this proved the point — a spawned `sleep` child was
			// invisible until this pass existed.
			const rows = all.filter((l) => {
				const [pid, ppid] = l.split(/\s+/);
				return pids.has(pid) || pids.has(ppid);
			});
			if (rows.length) return rows;
		} catch {
			/* try the next form */
		}
	}
	return null;
}

const timer = setTimeout(() => {
	// getActiveResourcesInfo returns coarse type names ('TCPSocketWrap',
	// 'Timeout', 'TCPWRAP'…) — enough to tell a lingering socket from a timer,
	// which is the distinction that decides where to look next.
	const resources = process.getActiveResourcesInfo?.() ?? ['(unavailable)'];
	const counts = resources.reduce((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});

	process.stderr.write(
		`\n[handles] STILL ALIVE after ${DEADLINE_MS}ms — this process is what turbo is waiting on.\n` +
			`[handles] pid ${process.pid}, ppid ${process.ppid}\n` +
			`[handles] argv: ${process.argv.join(' ')}\n` +
			`[handles] cwd:  ${process.cwd()}\n` +
			`[handles] active: ${JSON.stringify(counts)}\n` +
			`[handles] a socket or pool ⇒ an unclosed client; a Timeout ⇒ an interval never stopped.\n`,
	);

	// NAME the process being waited on, rather than inferring it.
	//
	// Handle counts took this as far as they can. Across three hangs they said
	// the same thing — `npm test` holding {PipeWrap:3, ProcessWrap:1}, `turbo
	// test` holding {ProcessWrap:1}, and NO package-level process reporting at
	// all — which proves a child is being waited on but not WHICH, so every
	// theory built on it (esbuild orphan, the npm wrapper) was inference.
	// Two deliberate bisect attempts failed to reproduce it, so the answer has
	// to come from the runs that really hang.
	//
	// The STAT column is the discriminator this needs:
	//   Z  ⇒ zombie — the child EXITED and was never reaped. turbo's bug.
	//   S  ⇒ sleeping — genuinely alive and holding the pipe. ours.
	// Those two have looked identical in every dump so far.
	if (process.env['FONDERIE_HANDLE_DUMP_TREE'] !== '0') {
		const rows = processTree();
		if (!rows) {
			process.stderr.write('[handles] process tree unavailable (no usable ps)\n');
		} else {
			// STAT's third column is the discriminator: Z means the child exited and
			// was never reaped, S means it is genuinely alive holding the pipe.
			const zombies = rows.filter((l) => /^\d+\s+\d+\s+Z/.test(l));
			process.stderr.write(
				`[handles] process tree (pid ppid stat elapsed args), ${rows.length} row(s):\n` +
					rows.map((l) => `[handles]   ${l.slice(0, 160)}\n`).join('') +
					(zombies.length
						? `[handles] ${zombies.length} ZOMBIE(S) — a child exited and was never reaped; turbo waits on a dead process.\n`
						: '[handles] no zombies — whatever holds the pipe is ALIVE; find it above by ppid.\n'),
			);
		}
	}
	process.stderr.write('\n');
}, DEADLINE_MS);

// Must not keep the process alive itself, or this tool becomes the bug.
timer.unref();
