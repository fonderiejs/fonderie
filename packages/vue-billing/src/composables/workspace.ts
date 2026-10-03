import { useWorkspaceId } from '@fonderie/vue';
import type { Ref } from 'vue';
import { watch } from 'vue';

// Billing data belongs to a subscriber — with workspace billing, the selected
// workspace. These two helpers keep a composable honest across a switch.

// Follow the workspace the billing sub-client is scoped to; on a switch, run
// `onSwitch` (clear what was shown, then re-read). Returns the id Ref.
export function onWorkspaceSwitch(
	billing: unknown,
	onSwitch: () => void,
): Readonly<Ref<string | undefined>> {
	const workspaceId = useWorkspaceId(billing);
	watch(workspaceId, () => onSwitch());
	return workspaceId;
}

// Latest request wins: call at the start of a load; the returned check is true
// only while no newer load has started. A slow answer for the previous
// workspace must not land on top of the current one.
export function latestRequest(): () => () => boolean {
	let seq = 0;
	return () => {
		const mine = ++seq;
		return () => mine === seq;
	};
}
