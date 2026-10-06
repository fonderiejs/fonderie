import type { IFonderieContext, Middleware } from '@fonderie/core';
import { HTTP, constantTimeEqual, setApiResponse } from '@fonderie/core';
import { validate } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';

import { SCOPES, grants } from '../tokens';
import type { AdminScope } from '../types';
import { type ISecretBox, passwordProblem, totpUri } from './crypto';
import {
	claimSchema,
	enrollmentSchema,
	factorSchema,
	inspectLinkSchema,
	inviteSchema,
	loginSchema,
	redeemLinkSchema,
	updateOperatorSchema,
} from './schemas';
import {
	ABSOLUTE_MS,
	EMAIL_RE,
	INVITE_HOURS,
	type IOperatorRow,
	PENDING_MS,
	RECOVERY_HOURS,
	type SessionStage,
	checkPassword,
	checkSecondFactor,
	claimFirstOperator,
	confirmEnrollment,
	createLink,
	createSession,
	deleteOperatorSessions,
	deleteSession,
	enrollmentSecret,
	findLink,
	findOperator,
	listOperators,
	lockMinutes,
	markStepUp,
	normalizeEmail,
	operatorCount,
	publicOperator,
	readSession,
	redeemLink,
	stepUpFresh,
} from './service';

// ── the cookie ─────────────────────────────────────────────────────────────
// HttpOnly (script cannot read it), SameSite=Strict (never sent from another
// site), Secure everywhere except plain-http localhost. Over HTTPS it takes
// the __Host- prefix, which the browser enforces: Secure, Path=/, no Domain —
// so a sibling subdomain cannot set or shadow it.

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
const isSecure = (ctx: IFonderieContext): boolean => {
	const u = new URL(ctx.request.url);
	return !(u.protocol === 'http:' && LOCAL.has(u.hostname));
};
const cookieName = (ctx: IFonderieContext) =>
	isSecure(ctx) ? '__Host-fonderie_admin' : 'fonderie_admin';

export function readCookie(ctx: IFonderieContext): string {
	const header = ctx.request.headers.get('cookie') ?? '';
	const want = cookieName(ctx);
	for (const part of header.split(';')) {
		const i = part.indexOf('=');
		if (i > 0 && part.slice(0, i).trim() === want)
			return decodeURIComponent(part.slice(i + 1).trim());
	}
	return '';
}

function withCookie(
	res: Response,
	ctx: IFonderieContext,
	value: string,
	maxAgeMs: number,
): Response {
	const attrs = [
		`${cookieName(ctx)}=${value}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Strict',
		`Max-Age=${Math.floor(maxAgeMs / 1000)}`,
	];
	if (isSecure(ctx)) attrs.push('Secure');
	res.headers.append('set-cookie', attrs.join('; '));
	res.headers.set('cache-control', 'no-store');
	return res;
}
const clearCookie = (res: Response, ctx: IFonderieContext) => withCookie(res, ctx, '', 0);

// ── CSRF ───────────────────────────────────────────────────────────────────
// SameSite=Strict already keeps the cookie off cross-SITE requests. A sibling
// subdomain is the same site, so a cookie-authenticated write must also come
// from THIS origin: browsers send Origin (or Sec-Fetch-Site) on every
// non-GET fetch. A request with neither is not from a browser page.
export function sameOrigin(ctx: IFonderieContext): boolean {
	const origin = ctx.request.headers.get('origin');
	const host = ctx.request.headers.get('host') ?? new URL(ctx.request.url).host;
	if (origin) {
		try {
			return new URL(origin).host === host;
		} catch {
			return false;
		}
	}
	const site = ctx.request.headers.get('sec-fetch-site');
	return site === null || site === 'same-origin';
}

// ── per-IP attempt limit ───────────────────────────────────────────────────
// Best effort, in memory: per instance on serverless. The durable brake is the
// per-account lockout in the database; this one stops one address from
// spraying many accounts.
const WINDOW_MS = 10 * 60_000;
const PER_IP = 30;
const attempts = new Map<string, number[]>();
function ipLimited(ctx: IFonderieContext): boolean {
	const ip = ctx.meta.clientIp ?? 'unknown';
	const now = Date.now();
	const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	recent.push(now);
	attempts.set(ip, recent);
	if (attempts.size > 10_000) attempts.clear();
	return recent.length > PER_IP;
}
/** Test hook: forget every address. */
export const resetAttemptLimits = (): void => attempts.clear();

// ── helpers ────────────────────────────────────────────────────────────────

const body = (ctx: IFonderieContext): Record<string, unknown> =>
	(ctx.meta['body'] as Record<string, unknown> | undefined) ?? {};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const bearer = (ctx: IFonderieContext): string => {
	const h = ctx.request.headers.get('authorization') ?? '';
	return h.startsWith('Bearer ') ? h.slice(7) : '';
};

const BAD_CREDENTIALS = () =>
	setApiResponse(
		HTTP.UNAUTHORIZED,
		'INVALID_CREDENTIALS',
		'That email and password do not match an operator.',
	);
const BAD_CODE = () =>
	setApiResponse(
		HTTP.UNAUTHORIZED,
		'INVALID_CODE',
		'That code did not work. Codes change every 30 seconds.',
	);
const LOCKED = (op: IOperatorRow) =>
	setApiResponse(
		HTTP.TOO_MANY_REQUESTS,
		'LOCKED',
		`Too many attempts. Try again in ${lockMinutes(op)} minute(s).`,
	);
const TOO_FAST = () =>
	setApiResponse(
		HTTP.TOO_MANY_REQUESTS,
		'RATE_LIMITED',
		'Too many attempts from this address. Wait a few minutes.',
	);
const WRONG_STAGE = () =>
	setApiResponse(HTTP.UNAUTHORIZED, 'NO_SESSION', 'Start again from sign-in.');
const CROSS_ORIGIN = () =>
	setApiResponse(HTTP.FORBIDDEN, 'CROSS_ORIGIN', 'This request did not come from the admin page.');

const stateOf = (stage: SessionStage) =>
	stage === 'active' ? 'signed-in' : stage === 'enroll' ? 'needs-enrollment' : 'needs-2fa';

export interface IOperatorDeps {
	store: IStoreAdapter;
	box: ISecretBox;
	rootToken: string;
	/** Where the console lives, for the links it hands out: '<prefix>/ui'. */
	uiPath: (ctx: IFonderieContext) => string;
}

async function startSession(
	deps: IOperatorDeps,
	ctx: IFonderieContext,
	op: IOperatorRow,
	stage: SessionStage,
	payload: Record<string, unknown> = {},
) {
	ctx.meta['adminOperator'] = op.email;
	const id = await createSession(deps.store, ctx, op.id, stage);
	const res = setApiResponse(HTTP.OK, 'ADMIN_SESSION', 'Session', {
		state: stateOf(stage),
		operator: publicOperator(op),
		...payload,
	});
	return withCookie(res, ctx, id, stage === 'active' ? ABSOLUTE_MS : PENDING_MS);
}

/** A pending (or active) session of the given stage, from the cookie. */
async function sessionAt(deps: IOperatorDeps, ctx: IFonderieContext, stage: SessionStage) {
	const cookie = readCookie(ctx);
	const found = await readSession(deps.store, cookie);
	return found && found.session.stage === stage ? { ...found, cookie } : null;
}

// ── the public sign-in routes ─────────────────────────────────────────────
// Outside the admin guard: they are how a guard-passing session comes to
// exist. Every write is same-origin-checked and attempt-limited.

export function sessionRoutes(deps: IOperatorDeps): Array<[string, string, Middleware[]]> {
	const { store, box } = deps;
	// Every sign-in write: same-origin, attempt-limited, attributed to 'anonymous'
	// in the log until a session names someone.
	const check: Middleware = async (ctx, next) => {
		ctx.meta['adminActor'] = 'anonymous';
		if (ctx.request.method !== 'GET' && !sameOrigin(ctx)) return CROSS_ORIGIN();
		if (ctx.request.method !== 'GET' && ipLimited(ctx)) return TOO_FAST();
		return next();
	};

	return [
		[
			'GET',
			'/_admin/session',
			[
				check,
				async (ctx) => {
					const found = await readSession(store, readCookie(ctx));
					const claimable = (await operatorCount(store)) === 0;
					return setApiResponse(HTTP.OK, 'ADMIN_SESSION', 'Session', {
						state: found ? stateOf(found.session.stage) : 'signed-out',
						operator: found ? publicOperator(found.op) : null,
						claimable,
						stepUpFresh: found ? stepUpFresh(found.session) : false,
					});
				},
			],
		],
		[
			// The one-time claim. Needs the root token AND an empty operator table;
			// after the first operator exists it is permanently refused.
			'POST',
			'/_admin/session/claim',
			[
				check,
				validate(claimSchema),
				async (ctx) => {
					if (!constantTimeEqual(bearer(ctx), deps.rootToken)) {
						return setApiResponse(
							HTTP.UNAUTHORIZED,
							'UNAUTHORIZED',
							'Claiming needs the root admin token.',
						);
					}
					const b = body(ctx);
					const email = normalizeEmail(str(b['email']));
					if (!EMAIL_RE.test(email))
						return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'Enter a valid email address.');
					const problem = passwordProblem(b['password']);
					if (problem) return setApiResponse(HTTP.UNPROCESSABLE, 'WEAK_PASSWORD', problem);
					const op = await claimFirstOperator(store, {
						email,
						name: str(b['name']) || undefined,
						password: str(b['password']),
					});
					if (!op)
						return setApiResponse(
							HTTP.CONFLICT,
							'ALREADY_CLAIMED',
							'This console already has operators. Ask one for an invite.',
						);
					return startSession(deps, ctx, op, 'enroll');
				},
			],
		],
		[
			'POST',
			'/_admin/session/login',
			[
				check,
				validate(loginSchema),
				async (ctx) => {
					const b = body(ctx);
					const result = await checkPassword(store, str(b['email']), str(b['password']));
					if (result.op && 'locked' in result && result.locked) return LOCKED(result.op);
					if (!result.ok || !result.op) return BAD_CREDENTIALS();
					return startSession(
						deps,
						ctx,
						result.op,
						result.op.totpConfirmedAt ? 'password' : 'enroll',
					);
				},
			],
		],
		[
			'GET',
			'/_admin/session/enrollment',
			[
				check,
				async (ctx) => {
					const s = await sessionAt(deps, ctx, 'enroll');
					if (!s) return WRONG_STAGE();
					const secret = await enrollmentSecret(store, box, s.op);
					const issuer = `Admin · ${new URL(ctx.request.url).hostname}`;
					const res = setApiResponse(HTTP.OK, 'ENROLLMENT', 'Scan this with an authenticator app', {
						secret,
						uri: totpUri(issuer, s.op.email, secret),
						account: s.op.email,
						issuer,
					});
					res.headers.set('cache-control', 'no-store');
					return res;
				},
			],
		],
		[
			'POST',
			'/_admin/session/enrollment',
			[
				check,
				validate(enrollmentSchema),
				async (ctx) => {
					const s = await sessionAt(deps, ctx, 'enroll');
					if (!s) return WRONG_STAGE();
					const codes = await confirmEnrollment(store, box, s.op, str(body(ctx)['code']));
					if (!codes) {
						const fresh = await findOperator(store, { id: s.op.id });
						return fresh && lockMinutes(fresh) ? LOCKED(fresh) : BAD_CODE();
					}
					// A new session id at the privilege change: a pending id that leaked
					// never becomes a signed-in one.
					await deleteSession(store, s.cookie);
					const op = (await findOperator(store, { id: s.op.id })) ?? s.op;
					return startSession(deps, ctx, op, 'active', { backupCodes: codes });
				},
			],
		],
		[
			'POST',
			'/_admin/session/verify',
			[
				check,
				validate(factorSchema),
				async (ctx) => {
					const s = await sessionAt(deps, ctx, 'password');
					if (!s) return WRONG_STAGE();
					const b = body(ctx);
					const r = await checkSecondFactor(store, box, s.op, {
						code: b['code'],
						backupCode: b['backupCode'],
					});
					if (!r.ok) {
						const fresh = await findOperator(store, { id: s.op.id });
						return fresh && lockMinutes(fresh) ? LOCKED(fresh) : BAD_CODE();
					}
					await deleteSession(store, s.cookie);
					await store.query(
						`UPDATE fonderie_admin_operators SET last_login_at = now() WHERE id = $1`,
						[s.op.id],
					);
					return startSession(
						deps,
						ctx,
						s.op,
						'active',
						r.via === 'backup' ? { backupCodesLeft: r.backupLeft } : {},
					);
				},
			],
		],
		[
			// A fresh code for the next five minutes of dangerous actions.
			'POST',
			'/_admin/session/step-up',
			[
				check,
				validate(factorSchema),
				async (ctx) => {
					const s = await sessionAt(deps, ctx, 'active');
					if (!s) return WRONG_STAGE();
					const b = body(ctx);
					const r = await checkSecondFactor(store, box, s.op, {
						code: b['code'],
						backupCode: b['backupCode'],
					});
					if (!r.ok) return BAD_CODE();
					await markStepUp(store, s.session.idHash);
					return setApiResponse(HTTP.OK, 'STEPPED_UP', 'Confirmed for five minutes', {
						stepUpFresh: true,
						...(r.via === 'backup' ? { backupCodesLeft: r.backupLeft } : {}),
					});
				},
			],
		],
		[
			'DELETE',
			'/_admin/session',
			[
				check,
				async (ctx) => {
					const cookie = readCookie(ctx);
					if (cookie) await deleteSession(store, cookie);
					return clearCookie(setApiResponse(HTTP.OK, 'SIGNED_OUT', 'Signed out'), ctx);
				},
			],
		],
		[
			// What a link is for, before the person sets a password. POST so the
			// token never sits in a URL a proxy logs.
			'POST',
			'/_admin/session/link/inspect',
			[
				check,
				validate(inspectLinkSchema),
				async (ctx) => {
					const link = await findLink(store, str(body(ctx)['token']));
					return link
						? setApiResponse(HTTP.OK, 'LINK', 'Link', { kind: link.kind, email: link.email })
						: setApiResponse(
								HTTP.NOT_FOUND,
								'INVALID_LINK',
								'This link has expired or was already used. Ask for a new one.',
							);
				},
			],
		],
		[
			'POST',
			'/_admin/session/link',
			[
				check,
				validate(redeemLinkSchema),
				async (ctx) => {
					const b = body(ctx);
					const problem = passwordProblem(b['password']);
					if (problem) return setApiResponse(HTTP.UNPROCESSABLE, 'WEAK_PASSWORD', problem);
					const r = await redeemLink(store, str(b['token']), {
						password: str(b['password']),
						name: str(b['name']) || undefined,
					});
					if ('error' in r) {
						return r.error === 'ALREADY_OPERATOR'
							? setApiResponse(
									HTTP.CONFLICT,
									'ALREADY_OPERATOR',
									'That email is already an operator. Sign in instead.',
								)
							: setApiResponse(
									HTTP.NOT_FOUND,
									'INVALID_LINK',
									'This link has expired or was already used. Ask for a new one.',
								);
					}
					return startSession(deps, ctx, r.op, 'enroll');
				},
			],
		],
	];
}

// ── guard integration ──────────────────────────────────────────────────────

/**
 * Dangerous for a PERSON: needs a code from the last five minutes. Reads never
 * do; revealing a secret, minting a token or link, applying a migration and
 * deleting anything do.
 */
export function needsStepUp(method: string, path: string, needed: AdminScope | 'root'): boolean {
	const m = method.toUpperCase();
	if (m === 'GET' || m === 'HEAD') return false;
	return (
		needed === 'root' ||
		needed === 'secrets' ||
		m === 'DELETE' ||
		/\/migrations\/[^/]+\/apply$/.test(path)
	);
}

/**
 * The cookie path of the admin guard. Returns null when the request carries
 * no operator session at all (the caller then answers 401 as before), or the
 * Response to send, or 'ok' with the operator recorded for the log.
 */
export async function authorizeOperator(
	store: IStoreAdapter,
	ctx: IFonderieContext,
	needed: AdminScope | 'root',
	stepUp: boolean,
): Promise<Response | 'ok' | null> {
	const found = await readSession(store, readCookie(ctx));
	if (!found || found.session.stage !== 'active') return null;
	const method = ctx.request.method.toUpperCase();
	if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(ctx)) return CROSS_ORIGIN();
	// For a person, 'root' (tokens, operators) means the highest scope.
	const scope: AdminScope = needed === 'root' ? 'secrets' : needed;
	if (!grants(found.op.scopes, scope)) {
		return setApiResponse(
			HTTP.FORBIDDEN,
			'FORBIDDEN',
			`Your operator account lacks the '${scope}' scope`,
		);
	}
	ctx.meta['adminOperator'] = found.op.email;
	if (stepUp && !stepUpFresh(found.session)) {
		return setApiResponse(
			HTTP.FORBIDDEN,
			'STEP_UP_REQUIRED',
			'Enter a code from your authenticator app to continue.',
		);
	}
	return 'ok';
}

// ── managing operators (behind the guard, root-level) ──────────────────────

const actorOf = (ctx: IFonderieContext): string =>
	typeof ctx.meta['adminOperator'] === 'string'
		? `operator:${ctx.meta['adminOperator']}`
		: 'root-token';

const validScopes = (v: unknown): AdminScope[] | null =>
	Array.isArray(v) && v.length > 0 && v.every((s) => SCOPES.includes(s as AdminScope))
		? [...new Set(v as AdminScope[])]
		: null;

export function operatorAdminRoutes(
	deps: IOperatorDeps,
): Array<[string, string, Middleware[], 'read' | 'root']> {
	const { store } = deps;
	const link = (ctx: IFonderieContext, token: string) => `${deps.uiPath(ctx)}#/link/${token}`;
	const idOf = (ctx: IFonderieContext) => ctx.meta.params?.['id'] ?? '';
	return [
		[
			'GET',
			'/_admin/access/operators',
			[async () => setApiResponse(HTTP.OK, 'OPERATORS', 'Operators', await listOperators(store))],
			'read',
		],
		[
			'POST',
			'/_admin/access/operators/invites',
			[
				validate(inviteSchema),
				async (ctx) => {
					const b = body(ctx);
					const email = normalizeEmail(str(b['email']));
					if (!EMAIL_RE.test(email))
						return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'Enter a valid email address.');
					const scopes = validScopes(b['scopes']);
					if (!scopes)
						return setApiResponse(
							HTTP.UNPROCESSABLE,
							'INVALID',
							`scopes must be a non-empty list of ${SCOPES.join(', ')}`,
						);
					if (await findOperator(store, { email }))
						return setApiResponse(
							HTTP.CONFLICT,
							'ALREADY_OPERATOR',
							'That email is already an operator.',
						);
					const hours = Number.isInteger(b['expiresInHours'])
						? Math.min(Math.max(b['expiresInHours'] as number, 1), 336)
						: INVITE_HOURS;
					const l = await createLink(store, {
						kind: 'invite',
						email,
						scopes,
						createdBy: actorOf(ctx),
						hours,
					});
					return setApiResponse(HTTP.CREATED, 'INVITE_CREATED', 'Invite link — shown once', {
						id: l.id,
						email,
						scopes,
						expiresAt: l.expiresAt,
						token: l.token,
						url: link(ctx, l.token),
					});
				},
			],
			'root',
		],
		[
			// Lost password or lost authenticator: a single-use link that sets a new
			// password and makes them enroll again. Signs them out everywhere.
			'POST',
			'/_admin/access/operators/:id/recovery',
			[
				async (ctx) => {
					const op = await findOperator(store, { id: idOf(ctx) });
					if (!op) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such operator');
					// One transaction (createLink joins it): signed out everywhere AND
					// handed a link, or neither. Separately, a failed insert left them
					// signed out with no way back in, and a failed sign-out left the
					// lost device's sessions alive beside a fresh recovery link.
					const l = await store.transaction(async (tx) => {
						await deleteOperatorSessions(tx, op.id);
						return createLink(tx, {
							kind: 'recovery',
							email: op.email,
							operatorId: op.id,
							createdBy: actorOf(ctx),
							hours: RECOVERY_HOURS,
						});
					});
					return setApiResponse(HTTP.CREATED, 'RECOVERY_CREATED', 'Recovery link — shown once', {
						id: l.id,
						email: op.email,
						expiresAt: l.expiresAt,
						token: l.token,
						url: link(ctx, l.token),
					});
				},
			],
			'root',
		],
		[
			'PUT',
			'/_admin/access/operators/:id',
			[
				validate(updateOperatorSchema),
				async (ctx) => {
					const b = body(ctx);
					const op = await findOperator(store, { id: idOf(ctx) });
					if (!op) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such operator');
					const scopes = b['scopes'] === undefined ? op.scopes : validScopes(b['scopes']);
					if (!scopes)
						return setApiResponse(
							HTTP.UNPROCESSABLE,
							'INVALID',
							`scopes must be a non-empty list of ${SCOPES.join(', ')}`,
						);
					if (
						ctx.meta['adminOperator'] === op.email &&
						!scopes.includes('secrets') &&
						op.scopes.includes('secrets')
					) {
						return setApiResponse(
							HTTP.CONFLICT,
							'SELF_DEMOTION',
							'You cannot remove your own highest scope. Ask another operator.',
						);
					}
					const disabled = b['disabled'];
					if (disabled === true && ctx.meta['adminOperator'] === op.email) {
						return setApiResponse(
							HTTP.CONFLICT,
							'SELF_DISABLE',
							'You cannot disable yourself. Ask another operator.',
						);
					}
					// Any change of rights ends their sessions: new rights apply at next
					// sign-in. ONE statement, so the change and the sign-out commit
					// together — run as two, a failure between them left a demoted or
					// disabled operator signed in with the rights they just lost.
					const [row] = await store.query<IOperatorRow>(
						`WITH u AS (
						   UPDATE fonderie_admin_operators
						      SET scopes = $2, name = coalesce($3, name),
						          disabled_at = CASE WHEN $4::boolean IS NULL THEN disabled_at WHEN $4 THEN coalesce(disabled_at, now()) ELSE NULL END
						    WHERE id = $1
						    RETURNING id, email, name, password_hash AS "passwordHash", scopes, totp_secret AS "totpSecret",
						      totp_confirmed_at AS "totpConfirmedAt", totp_last_step AS "totpLastStep", backup_codes AS "backupCodes",
						      failed_attempts AS "failedAttempts", locked_until AS "lockedUntil", created_by AS "createdBy",
						      created_at AS "createdAt", last_login_at AS "lastLoginAt", disabled_at AS "disabledAt"
						 ), ended AS (
						   DELETE FROM fonderie_admin_sessions WHERE operator_id IN (SELECT id FROM u)
						 )
						 SELECT * FROM u`,
						[
							op.id,
							scopes,
							typeof b['name'] === 'string' ? b['name'] : null,
							typeof disabled === 'boolean' ? disabled : null,
						],
					);
					if (!row) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such operator');
					return setApiResponse(
						HTTP.OK,
						'OPERATOR_UPDATED',
						'Operator updated',
						publicOperator(row),
					);
				},
			],
			'root',
		],
		[
			'DELETE',
			'/_admin/access/operators/links/:id',
			[
				async (ctx) => {
					const rows = await store.query(
						`UPDATE fonderie_admin_invites SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id`,
						[idOf(ctx)],
					);
					return rows.length
						? setApiResponse(HTTP.OK, 'LINK_REVOKED', 'Link revoked')
						: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such live link');
				},
			],
			'root',
		],
	];
}
