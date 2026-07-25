import type { ICourierConfig } from './config';

// Production-readiness guard for courier. A message type routed to a channel
// that has no registered provider is silently dropped by the dispatcher — with
// `requireVerification` on, that means verification / password-reset emails
// vanish and users lock themselves out. This surfaces the gap loudly at boot
// (from `CourierModule.install`), before any message is sent. Warn-only:
// channel setups vary legitimately (an app may run in-app only), so this never
// blocks boot — unlike auth's fatal weak-secret guard.
//
// Checks against the channels actually **registered** on the dispatcher (not
// just `config.email`/`sms`/`push`), so channels registered programmatically via
// `registerChannel` are correctly counted as present.
export function validateCourierConfig(
	config: ICourierConfig,
	registeredChannels: Iterable<string>,
): void {
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

	for (const [channel, types] of gaps) {
		console.warn(
			`[courier] ${types.length} message type(s) route to the '${channel}' channel but ` +
				`no '${channel}' provider is registered — these will be silently dropped: ` +
				`${types.join(', ')}. Configure \`config.${channel}\` (or register a channel).`,
		);
	}
}
