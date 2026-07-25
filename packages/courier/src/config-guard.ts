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

	return [...gaps].map(([channel, types]) => ({
		module: MODULE,
		severity: 'warning' as const,
		message:
			`${types.length} message type(s) route to the '${channel}' channel but ` +
			`no '${channel}' provider is registered — these will be silently dropped: ` +
			`${types.join(', ')}. Configure \`config.${channel}\` (or register a channel).`,
	}));
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
