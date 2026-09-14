import type { IReadinessProblem } from '@fonderie/core';
import type { ICourierConfig } from './config';

const MODULE = '@fonderie/courier';

// Pure production-readiness assessment (no side effects) — shared by the
// boot-time guard and `CourierModule.checkReadiness`. A message type routed to a
// channel with no registered provider is silently dropped by the dispatcher —
// with `requireVerification` on, verification / reset emails vanish and users
// lock themselves out. These are `warning`-severity (channel setups vary
// legitimately — an app may run in-app only — so this never blocks boot, unlike
// auth's fatal weak-secret). Checks the channels actually **registered** on the
// dispatcher, so channels added via `registerChannel` count as present.
export function collectCourierConfigProblems(
	config: ICourierConfig,
	registeredChannels: Iterable<string>,
): IReadinessProblem[] {
	const registered = new Set(registeredChannels);
	const gaps = new Map<string, string[]>(); // channel → message types routed to it

	for (const [type, channels] of Object.entries(config.channels ?? {})) {
		for (const channel of channels) {
			if (!registered.has(channel)) {
				const types = gaps.get(channel) ?? [];
				types.push(type);
				gaps.set(channel, types);
			}
		}
	}

	const problems: IReadinessProblem[] = [...gaps].map(([channel, types]) => ({
		module: MODULE,
		severity: 'warning' as const,
		message:
			`${types.length} message type(s) route to the '${channel}' channel but ` +
			`no '${channel}' provider is registered — these will be silently dropped: ` +
			`${types.join(', ')}. Configure \`config.${channel}\` (or register a channel).`,
	}));

	// The INVERSE gap, and the quieter one: a message type whose CONTENT is
	// registered but which is routed nowhere. `dispatch` logs 'no channels
	// configured' and returns, so the notice is published, never delivered and
	// never retried — while the outbox reports success, because the event WAS
	// consumed. Nothing anywhere says a user did not get their mail.
	//
	// Shipping a package's default templates is a statement that the app intends
	// to send those notices, so a key with content but no route is almost always
	// drift: the package added a notice and the hand-written channel map did not
	// follow. Caught at BOOT rather than when the first user happens to trigger
	// it — and surfaced through checkReadiness, so it also shows up wherever the
	// app already reports health.
	const declared = new Set<string>();
	const defaults = config.templates?.defaults;
	for (const map of defaults ? (Array.isArray(defaults) ? defaults : [defaults]) : []) {
		for (const key of Object.keys(map ?? {})) declared.add(key);
	}
	// Membership, not contents: a type mapped to an EMPTY list is a deliberate
	// "this app does not send that one" (phone OTP in an email-only product, say)
	// and must not be nagged about. An ABSENT key is the drift. That distinction
	// is the difference between a guard people act on and one they mute.
	const routed = new Set(Object.keys(config.channels ?? {}));
	const unrouted = [...declared].filter((type) => !routed.has(type));

	if (unrouted.length > 0) {
		problems.push({
			module: MODULE,
			severity: 'warning' as const,
			message:
				`${unrouted.length} message type(s) ship a default template but are routed to no ` +
				`channel, so they are published and never delivered: ${unrouted.join(', ')}. ` +
				'Add them to `config.channels` — deriving it from the package\'s MESSAGE_KEYS ' +
				'rather than listing types by hand keeps it from drifting again. If one is ' +
				'deliberately not sent, map it to an empty list to say so.',
		});
	}

	return problems;
}

// Boot-time preflight, run from `CourierModule.install`. Warn-only.
export function validateCourierConfig(
	config: ICourierConfig,
	registeredChannels: Iterable<string>,
): void {
	for (const problem of collectCourierConfigProblems(config, registeredChannels)) {
		console.warn(`[courier] ${problem.message}`);
	}
}
