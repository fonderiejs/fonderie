import type { IncomingMessage, ServerResponse } from 'node:http';

export type ExpressResponse = ServerResponse
export type ExpressRequest = IncomingMessage & { body?: unknown }

export async function expressRequestToWeb(req: ExpressRequest): Promise<Request> {
	const encrypted = (req.socket as { encrypted?: boolean }).encrypted
	const protocol  = encrypted ? 'https' : 'http'
	const host      = req.headers['host'] ?? 'localhost'
	const url       = `${protocol}://${host}${req.url ?? '/'}`

	const headers = new Headers()
	for (const [key, value] of Object.entries(req.headers)) {
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

	const method  = req.method ?? 'GET'
	const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
	const body: ArrayBuffer | null = hasBody ? await readStream(req) : null

	return new Request(url, { method, headers, body })
}

export async function webResponseToExpress(
	webRes: Response,
	res: ExpressResponse,
): Promise<void> {
	res.statusCode = webRes.status
	webRes.headers.forEach((value, key) => res.setHeader(key, value))
	const buf = Buffer.from(await webRes.arrayBuffer())
	res.end(buf)
}

function readStream(req: IncomingMessage): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on('data',  (chunk: Buffer) => chunks.push(chunk))
		req.on('end',   () => resolve(Buffer.concat(chunks).buffer as ArrayBuffer))
		req.on('error', reject)
	})
}
