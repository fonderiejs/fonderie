import type { IApiError } from './types'

export class FonderieApiError extends Error {
	constructor(
		public readonly reason:      string,
		public readonly explanation: string,
		public readonly status:      number,
		public readonly details?:    unknown,
	) {
		super(explanation)
		this.name = 'FonderieApiError'
	}
}

export interface IRequestOptions {
	method:  string
	path:    string
	body?:   unknown
	token?:  string | undefined
	cookie?: string | undefined
}

export class HttpClient {
	constructor(private baseUrl: string) {}

	async request<T>(opts: IRequestOptions): Promise<T> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}

		if (opts.token)  headers['Authorization'] = `Bearer ${opts.token}`
		if (opts.cookie) headers['Cookie']        = opts.cookie

		const fetchInit: RequestInit = {
			method:      opts.method,
			headers,
			credentials: 'include',
		}
		if (opts.body !== undefined) fetchInit.body = JSON.stringify(opts.body)

		const res = await fetch(`${this.baseUrl}${opts.path}`, fetchInit)

		const data = await res.json() as T | IApiError

		if (!res.ok || res.status === 202) {
			const err = data as IApiError
			throw new FonderieApiError(err.reason, err.explanation, res.status, err.details)
		}

		return data as T
	}
}
