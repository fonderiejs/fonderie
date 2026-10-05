import type { IAdminRoute, IFonderieContext, Middleware } from '@fonderie/core';
import { HTTP, encodeKeysetCursor, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';
import { background, decodeKeysetCursor } from '@fonderie/core';
import type { ICourierMessage } from '@fonderie/core';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import { EVENT_KEYS, MESSAGE_KEYS, type IAuthConfig, type ISessionRevokedEvent } from './config';
import { deletionDate } from './services/pending-deletion';
import { eraseAccountNow, erasureHash } from './services/deletion-schedule';

import { decodeLoginCursor, toLoginHistoryPageDTO, toSessionDTO } from './dtos/login-activity';
import { toUserDTO } from './dtos/user';
import { normalizeEmailSafe } from './services/email';
import { validate } from './middlewares/validate';
import { deletionHoldSchema } from './schemas';
import type { IUserDTO } from './dtos/user';
import { LoginEventModel } from './models/login-event.model';
import { SessionModel } from './models/session.model';
import { UserModel } from './models/user.model';
import type { IUserPage } from './models/user.model';
import type { IUser } from './types';

// What the operator sees: the app's own user shape plus the fields support
// asks about first. Never the password hash, never the MFA secret.
export interface IAdminUserDTO extends IUserDTO {
	suspended: boolean;
	deletedAt: string | null;
	createdAt: string;
	/** Set while the account awaits deletion (archived): when, how, and whether it is held. */
	deletion?: IAdminDeletionDTO | null;
}

/** An archived account's deletion, as the operator sees it. */
export interface IAdminDeletionDTO {
	requestedAt: string;
	/** When the schedule erases it — unless it is held. */
	deleteOn: string;
	/** The channel the person confirmed with; the reminder goes the same way. */
	channel: string | null;
	remindedAt: string | null;
	/** A legal hold stops the schedule until an operator lifts it. */
	hold: { at: string; reason: string | null } | null;
}

interface IDeletionFacts {
	id: string;
	channel: string | null;
	remindedAt: Date | null;
	heldAt: Date | null;
	holdReason: string | null;
}

export function toAdminUserDTO(
	user: IUser,
	deletion?: { facts: IDeletionFacts | undefined; config: Pick<IAuthConfig, 'accountDeletion'> },
): IAdminUserDTO {
	const f = deletion?.facts;
	return {
		...toUserDTO(user),
		suspended: Boolean(user.suspended),
		deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
		createdAt: user.createdAt.toISOString(),
		...(deletion
			? {
					deletion: user.deletedAt
						? {
								requestedAt: user.deletedAt.toISOString(),
								deleteOn: deletionDate(user.deletedAt, deletion.config).toISOString(),
								channel: f?.channel ?? null,
								remindedAt: f?.remindedAt ? new Date(f.remindedAt).toISOString() : null,
								hold: f?.heldAt ? { at: new Date(f.heldAt).toISOString(), reason: f.holdReason } : null,
							}
						: null,
				}
			: {}),
	};
}

/** An erasure receipt — no personal data: identifiers as keyed hashes only. */
export interface IAdminErasureDTO {
	id: string;
	userId: string;
	emailHash: string | null;
	phoneHash: string | null;
	requestedAt: string | null;
	remindedAt: string | null;
	erasedAt: string;
	/** 'schedule' on its date, 'operator' for an "erase now". */
	initiatedBy: string;
	outcomes: Array<{ brick: string; erased: number; kept?: string }>;
}

export interface IAdminErasurePageDTO {
	erasures: IAdminErasureDTO[];
	nextCursor: string | null;
}

const ERASURE_COLUMNS = `id, user_id AS "userId", email_hash AS "emailHash", phone_hash AS "phoneHash",
	requested_at AS "requestedAt", reminded_at AS "remindedAt", erased_at AS "erasedAt",
	erased_at::text AS "erasedAtRaw", initiated_by AS "initiatedBy", outcomes`;

interface IErasureRow extends Omit<IAdminErasureDTO, 'requestedAt' | 'remindedAt' | 'erasedAt'> {
	requestedAt: Date | null;
	remindedAt: Date | null;
	erasedAt: Date;
	erasedAtRaw: string;
}

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
const toErasureDTO = ({ erasedAtRaw: _raw, ...r }: IErasureRow): IAdminErasureDTO => ({
	...r,
	requestedAt: iso(r.requestedAt),
	remindedAt: iso(r.remindedAt),
	erasedAt: new Date(r.erasedAt).toISOString(),
});

export interface IAdminUserPageDTO {
	users: IAdminUserDTO[];
	nextCursor: string | null;
}

export function toAdminUserPageDTO(page: IUserPage): IAdminUserPageDTO {
	const last = page.users[page.users.length - 1];
	// Full microsecond precision (createdAtRaw) so same-microsecond rows are
	// not skipped between pages.
	const nextCursor =
		page.hasMore && last
			? encodeKeysetCursor(last.createdAtRaw ?? last.createdAt.toISOString(), last.id)
			: null;
	return { users: page.users.map((u) => toAdminUserDTO(u)), nextCursor };
}

const ADMIN_PREFIX = '/_admin';
const idOf = (ctx: IFonderieContext) => ctx.meta.params?.['id'] ?? '';
const NOT_FOUND = () => setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such user');

// Declared at the default admin path so the route table reads literally;
// @fonderie/admin re-bases them under its prefix. There is no standalone
// surface: these exist only through composition.
type DeletionConfig = Pick<IAuthConfig, 'jwtSecret' | 'accountDeletion'>;

function adminRouteTable(
	store: IStoreAdapter,
	bus: EventBus | undefined,
	config: DeletionConfig | undefined,
): Array<[string, string, ...Middleware[]]> {
	const users = new UserModel(store);
	const sessions = new SessionModel(store);
	const events = new LoginEventModel(store);

	// The deletion columns of archived accounts, in one read for a whole page.
	const factsOf = async (list: IUser[]): Promise<Map<string, IDeletionFacts>> => {
		const ids = list.filter((u) => u.deletedAt).map((u) => u.id);
		if (ids.length === 0) return new Map();
		const rows = await store.query<IDeletionFacts>(
			`SELECT id, deletion_channel AS channel, deletion_reminded_at AS "remindedAt",
			        deletion_hold_at AS "heldAt", deletion_hold_reason AS "holdReason"
			 FROM fonderie_users WHERE id = ANY($1::uuid[])`,
			[ids],
		);
		return new Map(rows.map((r) => [r.id, r]));
	};
	const dto = async (user: IUser) =>
		config ? toAdminUserDTO(user, { facts: (await factsOf([user])).get(user.id), config }) : toAdminUserDTO(user);
	const NOT_PENDING = () =>
		setApiResponse(HTTP.CONFLICT, 'NOT_PENDING_DELETION', 'This account is not awaiting deletion.');
	const archived = async (ctx: IFonderieContext) =>
		users.findByIdIncludingDeleted(idOf(ctx)).then((u) => (u?.deletedAt ? u : null));

	const setSuspended =
		(suspended: boolean): Middleware =>
		async (ctx) => {
			const ok = await users.setSuspended(idOf(ctx), suspended);
			if (!ok) return NOT_FOUND();
			const user = await users.findById(idOf(ctx));
			return user
				? setApiResponse(
						HTTP.OK,
						suspended ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
						suspended ? 'User suspended' : 'User unsuspended',
						await dto(user),
					)
				: NOT_FOUND();
		};

	return [
		[
			'GET',
			'/_admin/users',
			// With an email, the exact lookup support reaches for. Without one, a
			// page of users — an operator who has to know a name before they can
			// see anything cannot discover who signed up this morning.
			async (ctx) => {
				const params = new URL(ctx.request.url).searchParams;
				// Accounts are stored under normalizeEmail: a search for the address a
				// user typed ('Jane+work@x.com') finds the account ('jane@x.com').
				const raw = params.get('email')?.trim();
				const email = raw ? normalizeEmailSafe(raw) ?? raw.toLowerCase() : undefined;
				if (email) {
					const user = await users.findByEmail(email);
					return user ? setApiResponse(HTTP.OK, 'USER', 'User', await dto(user)) : NOT_FOUND();
				}

				const rawLimit = Number(params.get('limit') ?? 50);
				const limit = Number.isFinite(rawLimit)
					? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
					: 50;
				const cursorParam = params.get('cursor');
				const cursor = cursorParam ? decodeLoginCursor(cursorParam) : null;
				if (cursorParam && !cursor)
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid cursor');
				const deleted = params.get('deleted') === '1' || params.get('deleted') === 'true';
				const page = await users.list({
					limit,
					...(cursor ? { cursor } : {}),
					...(deleted ? { deleted } : {}),
				});
				const body = toAdminUserPageDTO(page);
				if (config) {
					const facts = await factsOf(page.users);
					body.users = page.users.map((u) => toAdminUserDTO(u, { facts: facts.get(u.id), config }));
				}
				return setApiResponse(HTTP.OK, 'USERS', 'Users', body);
			},
		],
		[
			'GET',
			'/_admin/users/:id',
			async (ctx) => {
				// Read-only view: a soft-deleted account resolves (deletedAt set), so
				// an operator arriving from billing sees what happened to it.
				const user = await users.findByIdIncludingDeleted(idOf(ctx));
				return user ? setApiResponse(HTTP.OK, 'USER', 'User', await dto(user)) : NOT_FOUND();
			},
		],
		[
			'GET',
			'/_admin/users/:id/sessions',
			async (ctx) => {
				if (!(await users.findById(idOf(ctx)))) return NOT_FOUND();
				const rows = await sessions.listLiveByUser(idOf(ctx));
				return setApiResponse(
					HTTP.OK,
					'SESSIONS',
					'Live sessions',
					rows.map((r) => toSessionDTO(r, null)),
				);
			},
		],
		// Signs the user out everywhere. The one write support reaches for first.
		[
			'DELETE',
			'/_admin/users/:id/sessions',
			async (ctx) => {
				if (!(await users.findById(idOf(ctx)))) return NOT_FOUND();
				await sessions.deleteByUser(idOf(ctx));
				await background(bus?.emit(EVENT_KEYS.sessionRevoked, { userId: idOf(ctx), sids: null, reason: 'admin' } satisfies ISessionRevokedEvent));
				return setApiResponse(HTTP.OK, 'SESSIONS_REVOKED', 'All sessions revoked');
			},
		],
		[
			'GET',
			'/_admin/users/:id/login-history',
			async (ctx) => {
				if (!(await users.findById(idOf(ctx)))) return NOT_FOUND();
				const params = new URL(ctx.request.url).searchParams;
				const rawLimit = Number(params.get('limit') ?? 50);
				const limit = Number.isFinite(rawLimit)
					? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
					: 50;
				const cursorParam = params.get('cursor');
				const cursor = cursorParam ? decodeLoginCursor(cursorParam) : null;
				if (cursorParam && !cursor)
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid cursor');
				const page = await events.listByUser({
					userId: idOf(ctx),
					limit,
					...(cursor ? { cursor } : {}),
				});
				return setApiResponse(
					HTTP.OK,
					'LOGIN_HISTORY',
					'Login history',
					toLoginHistoryPageDTO(page),
				);
			},
		],
		['POST', '/_admin/users/:id/suspend', setSuspended(true)],
		['POST', '/_admin/users/:id/unsuspend', setSuspended(false)],
		...(config ? deletionRouteTable(store, bus, config, { users, dto, archived, NOT_PENDING }) : []),
	];
}

// ── Account deletion: the operator's side (design Phase 5) ─────────────────
// Only with the app's auth config: receipts are looked up by the identifiers'
// keyed hash, and erasing needs the app's erasers.
function deletionRouteTable(
	store: IStoreAdapter,
	bus: EventBus | undefined,
	config: DeletionConfig,
	h: {
		users: UserModel;
		dto: (u: IUser) => Promise<IAdminUserDTO>;
		archived: (ctx: IFonderieContext) => Promise<IUser | null>;
		NOT_PENDING: () => Response;
	},
): Array<[string, string, ...Middleware[]]> {
	const { users, dto, archived, NOT_PENDING } = h;
	return [
		// ── Account deletion: the operator's side (design Phase 5) ─────────
		// Cancel on the person's request (they asked support, not the app): the
		// account is active again, billing resumes (fonderie.user.restored) and
		// the person is told on the channel they deleted with.
		[
			'POST',
			'/_admin/users/:id/deletion/cancel',
			async (ctx) => {
				const [row] = await store.query<{ email: string | null; phone: string | null; locale: string | null; channel: string | null }>(
					`UPDATE fonderie_users u
					 SET deleted_at = NULL, deletion_channel = NULL, deletion_reminded_at = NULL,
					     deletion_hold_at = NULL, deletion_hold_reason = NULL, updated_at = now()
					 FROM (SELECT id, deletion_channel FROM fonderie_users WHERE id = $1 FOR UPDATE) old
					 WHERE u.id = old.id AND u.deleted_at IS NOT NULL
					 RETURNING u.email, u.phone, u.locale, old.deletion_channel AS channel`,
					[idOf(ctx)],
				);
				if (!row) return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND();
				await background(bus?.emit(EVENT_KEYS.userRestored, { userId: idOf(ctx) }));
				const viaSms = row.channel === 'sms' || (!row.email && !!row.phone);
				const address = viaSms ? row.phone : row.email;
				if (address) {
					await background(
						bus?.emit(NOTIFICATION_EVENT, {
							type: MESSAGE_KEYS.accountRestored,
							...(row.locale ? { locale: row.locale } : {}),
							data: {},
							recipient: viaSms
								? { email: null, phone: address, deviceToken: null }
								: { email: address, phone: null, deviceToken: null },
						} satisfies ICourierMessage),
					);
				}
				const user = await users.findById(idOf(ctx));
				return user
					? setApiResponse(HTTP.OK, 'ACCOUNT_RESTORED', 'Deletion cancelled; the account is active again', await dto(user))
					: NOT_FOUND();
			},
		],
		// A legal hold: the schedule neither reminds nor erases the account until
		// it is lifted. The reason is required — the next operator and the
		// auditor need to know why an erasure was not done on its date.
		[
			'POST',
			'/_admin/users/:id/deletion/hold',
			validate(deletionHoldSchema),
			async (ctx) => {
				const { reason } = ctx.meta['body'] as { reason: string };
				const [row] = await store.query<{ id: string }>(
					`UPDATE fonderie_users SET deletion_hold_at = now(), deletion_hold_reason = $2, updated_at = now()
					 WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
					[idOf(ctx), reason],
				);
				if (!row) return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND();
				const user = await archived(ctx);
				return user ? setApiResponse(HTTP.OK, 'DELETION_HELD', 'Deletion held', await dto(user)) : NOT_FOUND();
			},
		],
		// Lifting a hold lets the schedule erase the account (at once, if its date
		// has passed) — a DELETE, so an operator confirms it with a fresh code.
		[
			'DELETE',
			'/_admin/users/:id/deletion/hold',
			async (ctx) => {
				const [row] = await store.query<{ id: string }>(
					`UPDATE fonderie_users SET deletion_hold_at = NULL, deletion_hold_reason = NULL, updated_at = now()
					 WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
					[idOf(ctx)],
				);
				if (!row) return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND();
				const user = await archived(ctx);
				return user ? setApiResponse(HTTP.OK, 'DELETION_HOLD_LIFTED', 'Hold lifted', await dto(user)) : NOT_FOUND();
			},
		],
		// "Erase now": an urgent, verified request — only for an account the
		// person already asked to delete, never one on hold. Every brick's eraser
		// runs as on the schedule; the receipt says an operator did it.
		[
			'DELETE',
			'/_admin/users/:id/deletion',
			async (ctx) => {
				const r = await eraseAccountNow(store, config, idOf(ctx), bus);
				switch (r.status) {
					case 'erased': {
						const [receipt] = await store.query<IErasureRow>(
							`SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures WHERE user_id = $1`,
							[idOf(ctx)],
						);
						return setApiResponse(HTTP.OK, 'ACCOUNT_ERASED', 'Account erased', receipt ? toErasureDTO(receipt) : null);
					}
					case 'not-pending':
						return (await users.findById(idOf(ctx))) ? NOT_PENDING() : NOT_FOUND();
					case 'held':
						return setApiResponse(HTTP.CONFLICT, 'DELETION_HELD', 'This account is under a legal hold: lift it first.');
					case 'busy':
						return setApiResponse(HTTP.CONFLICT, 'ERASURE_IN_PROGRESS', 'This account is being erased right now.');
					case 'no-erasers':
						return setApiResponse(
							HTTP.CONFLICT,
							'ERASERS_NOT_CONFIGURED',
							'The app gives auth no erasers (accountDeletion.erasers): erasing now would leave every other brick’s data behind.',
						);
					case 'failed':
						return setApiResponse(
							HTTP.BAD_GATEWAY,
							'ERASURE_FAILED',
							`Erasure stopped at ${r.eraser}; the account stays archived. ${r.error}`,
							{ eraser: r.eraser },
						);
				}
			},
		],
		// The evidence: one receipt per erased account, newest first. With an
		// email or phone, the receipt for THAT person — the address is hashed
		// with the same key, never stored or compared in clear.
		[
			'GET',
			'/_admin/erasures',
			async (ctx) => {
				const params = new URL(ctx.request.url).searchParams;
				const rawEmail = params.get('email')?.trim();
				const rawPhone = params.get('phone')?.trim();
				if (rawEmail || rawPhone) {
					const email = rawEmail ? normalizeEmailSafe(rawEmail) ?? rawEmail.toLowerCase() : null;
					const rows = await store.query<IErasureRow>(
						`SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures
						 WHERE ($1::text IS NOT NULL AND email_hash = $1) OR ($2::text IS NOT NULL AND phone_hash = $2)
						 ORDER BY erased_at DESC, id DESC LIMIT 50`,
						[erasureHash(config.jwtSecret, email), erasureHash(config.jwtSecret, rawPhone ?? null)],
					);
					return setApiResponse(HTTP.OK, 'ERASURES', 'Erasures', { erasures: rows.map(toErasureDTO), nextCursor: null } satisfies IAdminErasurePageDTO);
				}
				const rawLimit = Number(params.get('limit') ?? 50);
				const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50;
				const cursorParam = params.get('cursor');
				const cursor = cursorParam ? decodeKeysetCursor(cursorParam) : null;
				if (cursorParam && !cursor) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid cursor');
				const rows = await store.query<IErasureRow>(
					`SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures
					 WHERE $1::timestamptz IS NULL OR (erased_at, id) < ($1::timestamptz, $2::uuid)
					 ORDER BY erased_at DESC, id DESC LIMIT $3`,
					[cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
				);
				const more = rows.length > limit;
				const page = rows.slice(0, limit);
				const last = page[page.length - 1];
				return setApiResponse(HTTP.OK, 'ERASURES', 'Erasures', {
					erasures: page.map(toErasureDTO),
					nextCursor: more && last ? encodeKeysetCursor(last.erasedAtRaw, last.id) : null,
				} satisfies IAdminErasurePageDTO);
			},
		],
		// Every receipt in one answer, for the auditor's evidence folder. Capped:
		// past it, the answer says so instead of silently truncating.
		[
			'GET',
			'/_admin/erasures/export',
			async () => {
				const CAP = 100_000;
				const rows = await store.query<IErasureRow>(
					`SELECT ${ERASURE_COLUMNS} FROM fonderie_account_erasures ORDER BY erased_at, id LIMIT $1`,
					[CAP + 1],
				);
				return setApiResponse(HTTP.OK, 'ERASURES_EXPORT', 'Erasure receipts', {
					generatedAt: new Date().toISOString(),
					truncated: rows.length > CAP,
					erasures: rows.slice(0, CAP).map(toErasureDTO),
				});
			},
		],
	];
}

/**
 * Auth's operator routes. With the app's auth `config`, also the account
 * deletion ones (pending deletions, legal hold, erase now, receipts) — AuthModule
 * always passes it.
 */
export function describeAuthAdminRoutes(
	store: IStoreAdapter,
	bus?: EventBus,
	config?: DeletionConfig,
): IAdminRoute[] {
	return adminRouteTable(store, bus, config).map(([method, path, ...handlers]) => ({
		method,
		path: path.slice(ADMIN_PREFIX.length),
		handlers,
	}));
}
