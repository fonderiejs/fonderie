import { HttpClient } from './http';
import { AuthClient } from './modules/auth';
import { BillingClient } from './modules/billing';
import { TokenStore } from './token-store';

export interface IFonderieClientOptions {
	baseUrl: string;
	accessToken?: string;
}

export class FonderieClient {
	readonly auth: AuthClient;
	readonly billing: BillingClient;

	private http: HttpClient;

	constructor(opts: IFonderieClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		const tokens = new TokenStore(opts.accessToken);
		this.auth = new AuthClient(this.http, tokens);
		this.billing = new BillingClient(this.http, tokens);
	}
}
