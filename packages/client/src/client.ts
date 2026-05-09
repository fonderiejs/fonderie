import { HttpClient }  from './http'
import { AuthClient }  from './modules/auth'

export interface IFonderieClientOptions {
	baseUrl:      string
	accessToken?: string
}

export class FonderieClient {
	readonly auth: AuthClient

	private http: HttpClient

	constructor(opts: IFonderieClientOptions) {
		this.http = new HttpClient(opts.baseUrl)
		this.auth = new AuthClient(this.http, opts.accessToken)
	}
}
