// Shared by every module of a FonderieClient so that setting the access
// token on one (e.g. AuthClient after login) is immediately visible to all
// the others (e.g. BillingClient) — they're separate module instances, but
// one session.
export class TokenStore {
	private token: string | undefined;
	private readonly listeners = new Set<(token: string | undefined) => void>();

	constructor(initial?: string) {
		this.token = initial;
	}

	get(): string | undefined {
		return this.token;
	}

	set(token: string | undefined) {
		if (token === this.token) return;
		this.token = token;
		for (const listener of this.listeners) listener(token);
	}

	/** Called after every change of the token; returns an unsubscribe. */
	onChange(listener: (token: string | undefined) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}
