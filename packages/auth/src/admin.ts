import type { IAdminRoute, IFonderieContext, Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { decodeLoginCursor, toLoginHistoryPageDTO, toSessionDTO } from './dtos/login-activity';
import { toUserDTO } from './dtos/user';
import type { IUserDTO } from './dtos/user';
import { LoginEventModel } from './models/login-event.model';
import { SessionModel } from './models/session.model';
import { UserModel } from './models/user.model';
import type { IUser } from './types';

// What the operator sees: the app's own user shape plus the fields support
// asks about first. Never the password hash, never the MFA secret.
export interface IAdminUserDTO extends IUserDTO {
	suspended: boolean;
	deletedAt: string | null;
	createdAt: string;
}

export function toAdminUserDTO(user: IUser): IAdminUserDTO {
	return {
		...toUserDTO(user),
		suspended: Boolean(user.suspended),
		deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
		createdAt: user.createdAt.toISOString(),
	};
}

const ADMIN_PREFIX = '/_admin';
const idOf = (ctx: IFonderieContext) => ctx.meta.params?.['id'] ?? '';
const NOT_FOUND = () => setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such user');

// Declared at the default admin path so the route table reads literally;
// @fonderie/admin re-bases them under its prefix. There is no standalone
// surface: these exist only through composition.
function adminRouteTable(store: IStoreAdapter): Array<[string, string, Middleware]> {
	const users = new UserModel(store);
	const sessions = new SessionModel(store);
	const events = new LoginEventModel(store);

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
						toAdminUserDTO(user),
					)
				: NOT_FOUND();
		};

	return [
		[
			'GET',
			'/_admin/users',
			async (ctx) => {
				const email = new URL(ctx.request.url).searchParams.get('email')?.trim().toLowerCase();
				if (!email)
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'email is required');
				const user = await users.findByEmail(email);
				return user ? setApiResponse(HTTP.OK, 'USER', 'User', toAdminUserDTO(user)) : NOT_FOUND();
			},
		],
		[
			'GET',
			'/_admin/users/:id',
			async (ctx) => {
				const user = await users.findById(idOf(ctx));
				return user ? setApiResponse(HTTP.OK, 'USER', 'User', toAdminUserDTO(user)) : NOT_FOUND();
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
	];
}

export function describeAuthAdminRoutes(store: IStoreAdapter): IAdminRoute[] {
	return adminRouteTable(store).map(([method, path, h]) => ({
		method,
		path: path.slice(ADMIN_PREFIX.length),
		handlers: [h],
	}));
}
