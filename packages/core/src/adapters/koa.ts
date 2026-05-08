import type { IncomingMessage } from 'node:http';

// Minimal Koa shape — no koa dep in core
export interface KoaContext {
	request: {
		url:     string;
		method:  string;
		rawBody?: string;
		headers: Record<string, string | string[] | undefined>;
	}
	response: {
		body: unknown;
		status: number;
		set(key: string, value: string): void;
	}
	req: IncomingMessage;
}

export function koaContextToWeb(ctx: KoaContext): Request {
	const encrypted = (ctx.req.socket as { encrypted?: boolean }).encrypted
	const protocol  = encrypted ? 'https' : 'http'
	const host      = ctx.request.headers['host'] ?? 'localhost'
	const url       = `${protocol}://${host}${ctx.request.url}`

	const headers = new Headers()
	for (const [key, value] of Object.entries(ctx.request.headers)) {
		if (!value) {
			continue
		}

		if (Array.isArray(value)) {
			for (const v of value) {
				headers.append(key, v)
			}
		} else {
			headers.set(key, value)
		}
	}

	return new Request(url, {
		headers,
		method:  ctx.request.method,
		body:    ctx.request.rawBody ?? null,
	})
}

export async function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void> {
	ctx.response.status = webRes.status
	webRes.headers.forEach((value, key) => ctx.response.set(key, value))
	ctx.response.body = await webRes.text()
}
