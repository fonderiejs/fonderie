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

// Warn ONCE per process. The condition is a property of how the app is wired,
// not of a particular request, so repeating it per login would bury it.
let warnedAboutMissingIdentity = false;

/**
 * Warn when a context carries no caller identity at all.
 *
 * A real HTTP request arriving through an adapter has a user-agent, and a
 * resolved client IP. BOTH being absent means the context was built by hand —
 * almost always `fonderie.handle(new Request(...))` called directly, with the
 * caller's headers dropped and no `{ meta: { clientIp } }` seed.
 *
 * The consequence is invisible until someone looks at it: login history shows
 * "Unknown device" and no IP for those sign-ins, and only for those, so it
 * reads as a display bug rather than missing security data. It happened on an
 * OAuth callback — the method an attacker is most likely to use, and the one
 * whose history therefore matters most.
 *
 * Only one of the two missing is NOT reported: a request can legitimately lack
 * a user-agent, and an IP can be unresolvable on some transports. Both missing
 * together is the signature of a synthesized request, which is why that is the
 * condition rather than either alone.
 */
function warnIfIdentityless(ctx: IFonderieContext): void {
	if (warnedAboutMissingIdentity) return;
	warnedAboutMissingIdentity = true;
	console.warn(
		`[auth] recording a security event with no client IP and no user-agent for ` +
			`${ctx.request.method} ${new URL(ctx.request.url).pathname}. Login history and ` +
			`session rows will show "Unknown device" with no IP for these. This is what a ` +
			`hand-built request looks like: if you call fonderie.handle() directly, forward ` +
			`the caller's user-agent header and pass the resolved IP as ` +
			`\`handle(req, { meta: { clientIp } })\` — resolve it with resolveClientIp from ` +
			`@fonderie/core/middlewares rather than reading the socket, or a proxied ` +
			`deployment records the proxy. Reported once per process.`,
	);
}

export function requestMeta(ctx: IFonderieContext): IRequestMeta {
	const ip = ctx.meta['clientIp'];
	const ua = ctx.request.headers.get('user-agent');
	const meta: IRequestMeta = {
		ipAddress: typeof ip === 'string' && ip.length > 0 ? ip : null,
		userAgent: ua && ua.length > 0 ? ua.slice(0, UA_MAX) : null,
	};
	if (meta.ipAddress === null && meta.userAgent === null) warnIfIdentityless(ctx);
	return meta;
}

// Test seam: the warning fires once per process by design, which would make
// every test after the first silently pass.
export function __resetIdentityWarningForTests(): void {
	warnedAboutMissingIdentity = false;
}
