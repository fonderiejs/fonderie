// The workspace a sub-client is scoped to (X-Workspace-ID), observable.
//
// Every workspace-scoped sub-client must REPORT its scope, not just hold it:
// a screen showing members, roles, customers or webhooks has to re-read when
// the user switches workspace, and it can only do that if the client tells it.
// Billing grew this first (#589); the others held the id silently, so their
// hooks kept showing the previous workspace's data after a switch.
export class WorkspaceScope {
	private id: string | undefined;
	private readonly listeners = new Set<(workspaceId: string | undefined) => void>();

	get(): string | undefined {
		return this.id;
	}

	/** Sets the scope; notifies listeners only when it actually changed. */
	set(workspaceId: string | undefined): void {
		if (workspaceId === this.id) return;
		this.id = workspaceId;
		for (const listener of [...this.listeners]) {
			try {
				listener(workspaceId);
			} catch {
				// A listener's failure must not stop the others.
			}
		}
	}

	/** Returns the unsubscribe. */
	on(listener: (workspaceId: string | undefined) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}
