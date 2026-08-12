// Shared by every module of a FonderieClient so that setting the access
// token on one (e.g. AuthClient after login) is immediately visible to all
// the others (e.g. BillingClient) — they're separate module instances, but
// one session.
export class TokenStore {
	private token: string | undefined;

	constructor(initial?: string) {
		this.token = initial;
	}

	get(): string | undefined {
		return this.token;
	}

	set(token: string | undefined) {
		this.token = token;
	}
}
