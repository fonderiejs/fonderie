import { useWorkspaceId } from '@fonderie/react';
import { useCallback, useRef, useState } from 'react';

// Billing data belongs to a subscriber — with workspace billing, the selected
// workspace. These two helpers keep a hook honest across a workspace switch.

// Follow the workspace the billing sub-client is scoped to. Returns its id (put
// it in the load effect's dependencies so a switch re-reads) and calls `reset`
// during render the moment it changes, so the previous workspace's
// subscription / card / invoices are never shown while the new ones load.
export function useWorkspaceSwitch(billing: unknown, reset: () => void): string | undefined {
	const workspaceId = useWorkspaceId(billing);
	const [shownFor, setShownFor] = useState(workspaceId);
	if (shownFor !== workspaceId) {
		setShownFor(workspaceId);
		reset();
	}
	return workspaceId;
}

// Latest request wins: call at the start of a load; the returned check is true
// only while no newer load has started. A slow answer for the previous
// workspace must not land on top of the current one.
export function useLatestRequest(): () => () => boolean {
	const seq = useRef(0);
	return useCallback(() => {
		const mine = ++seq.current;
		return () => mine === seq.current;
	}, []);
}
