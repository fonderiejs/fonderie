import { HttpClient } from './http';
import { AuditClient } from './modules/audit';
import { AuthClient } from './modules/auth';
import { BillingClient } from './modules/billing';
import { CustomersClient } from './modules/customers';
import { WebhooksClient } from './modules/webhooks';
import { WorkspacesClient } from './modules/workspaces';
import { TokenStore } from './token-store';

export interface IFonderieClientOptions {
	baseUrl: string;
	accessToken?: string;
}

export class FonderieClient {
	readonly auth: AuthClient;
	readonly billing: BillingClient;
	readonly workspaces: WorkspacesClient;
	readonly audit: AuditClient;
	readonly webhooks: WebhooksClient;
	readonly customers: CustomersClient;

	private http: HttpClient;

	constructor(opts: IFonderieClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		const tokens = new TokenStore(opts.accessToken);
		this.auth = new AuthClient(this.http, tokens);
		this.billing = new BillingClient(this.http, tokens);
		this.workspaces = new WorkspacesClient(this.http, tokens);
		this.audit = new AuditClient(this.http, tokens);
		this.webhooks = new WebhooksClient(this.http, tokens);
		this.customers = new CustomersClient(this.http, tokens);
	}
}
