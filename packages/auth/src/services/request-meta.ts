import type { IFonderieContext } from '@fonderie/core';

// The request metadata auth persists for security surfaces (session rows,
// login events): effective client IP and raw user-agent. IP comes from
// ctx.meta['clientIp'], which the adapters resolve with explicit proxy trust
// (resolveClientIp in @fonderie/core) — never re-derive forwarding logic here.
// The user-agent is stored raw and parsed at display time.
export interface IRequestMeta {
	ipAddress: string | null;
	userAgent: string | null;
}

// Cap the stored UA: real ones are <300 chars; anything longer is noise or abuse.
const UA_MAX = 512;

export function requestMeta(ctx: IFonderieContext): IRequestMeta {
	const ip = ctx.meta['clientIp'];
	const ua = ctx.request.headers.get('user-agent');
	return {
		ipAddress: typeof ip === 'string' && ip.length > 0 ? ip : null,
		userAgent: ua && ua.length > 0 ? ua.slice(0, UA_MAX) : null,
	};
}
