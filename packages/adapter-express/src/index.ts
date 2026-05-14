import type { IncomingMessage, ServerResponse } from 'node:http';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie-js/core';

export type ExpressRequest  = IncomingMessage & { body?: unknown; _fonderie?: IFonderieContext }
export type ExpressResponse = ServerResponse
export type ExpressNext     = (err?: unknown) => void

// ── Web Standard ↔ Express translation ───────────────────────────

export async function expressRequestToWeb(req: ExpressRequest): Promise<Request> {
	const encrypted = (req.socket as { encrypted?: boolean }).encrypted
	const protocol  = encrypted ? 'https' : 'http'
	const host      = req.headers['host'] ?? 'localhost'
	const url       = `${protocol}://${host}${req.url ?? '/'}`

	const headers = new Headers()
	for (const [key, value] of Object.entries(req.headers)) {
		if (!value) continue
		if (Array.isArray(value)) {
			for (const v of value) headers.append(key, v)
		} else {
			headers.set(key, value)
		}
	}

	const method  = req.method ?? 'GET'
	const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
	const body    = hasBody ? await readStream(req) : null

	return new Request(url, { method, headers, body })
}

export async function webResponseToExpress(webRes: Response, res: ExpressResponse): Promise<void> {
	res.statusCode = webRes.status
	webRes.headers.forEach((value, key) => res.setHeader(key, value))
	res.end(Buffer.from(await webRes.arrayBuffer()))
}

function readStream(req: IncomingMessage): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on('data',  (chunk: Buffer) => chunks.push(chunk))
		req.on('end',   () => resolve(Buffer.concat(chunks).buffer as ArrayBuffer))
		req.on('error', reject)
	})
}

// ── bridge ────────────────────────────────────────────────────────
//
// Express middleware. Populates req._fonderie with the fonderie context
// (user, workspace, meta) for all subsequent route handlers.
//
//   app.use(bridge(fonderie))

export function bridge(fonderie: FonderieApp) {
	return async (req: ExpressRequest, _res: ExpressResponse, next: ExpressNext) => {
		try {
			const webReq  = await expressRequestToWeb(req)
			req._fonderie = await fonderie.buildContext(webReq.clone())
			next()
		} catch (err) {
			next(err)
		}
	}
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Wraps any fonderie Middleware into an Express middleware function.
//
//   app.get('/jobs',
//     adapt(requireAuth),
//     adapt(withWorkspace(store)),
//     async (req, res) => { ... req._fonderie?.user ... }
//   )

export function adapt(middleware: Middleware) {
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		const ctx = req._fonderie
		if (!ctx) { next(new Error('[fonderie] bridge() must be registered before adapt()')); return }

		let continued = false
		const result = await middleware(ctx, async () => {
			continued = true
			return new Response()
		})

		if (continued) {
			next()
		} else {
			await webResponseToExpress(result, res)
		}
	}
}

// ── mount ─────────────────────────────────────────────────────────
//
// Registers fonderie's infrastructure routes as an Express catch-all.
// Always call AFTER registering your own business routes.
//
//   app.get('/jobs', ...)      // business route — matched first
//   mount(app, fonderie)       // fonderie infra — catch-all, matched last

export function mount(app: { all: (path: string, handler: (req: ExpressRequest, res: ExpressResponse) => void) => void }, fonderie: FonderieApp): void {
	app.all('*', async (req: ExpressRequest, res: ExpressResponse) => {
		const webReq = await expressRequestToWeb(req)
		const webRes = await fonderie.handle(webReq)
		await webResponseToExpress(webRes, res)
	})
}
