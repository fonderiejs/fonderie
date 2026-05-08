import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { toUserDTO }    from '../dtos/user';
import { findUserById } from '../services/session';
import { hashPassword } from '../services/password';
import type { IUser }   from '../types';

export function meHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const user = await findUserById(ctx.user.id, store);
		if (!user) {
			return setErrorResponse('NOT_FOUND', 'User not found', 404);
		}

		return setApiResponse(toUserDTO(user));
	}
}

const UPDATABLE_FIELDS = ['first_name', 'last_name', 'phone', 'profile_image_url', 'locale', 'timezone'] as const;

export function updateMeHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const body = ctx.meta['body'] as Record<string, unknown> | undefined;

		const sets:   string[]  = [];
		const values: unknown[] = [];

		const fieldMap: Record<string, string> = {
			firstName:       'first_name',
			lastName:        'last_name',
			phone:           'phone',
			profileImageUrl: 'profile_image_url',
			locale:          'locale',
			timezone:        'timezone',
		};

		for (const [key, col] of Object.entries(fieldMap)) {
			if (body?.[key] !== undefined) {
				values.push(body[key]);
				sets.push(`${col} = $${values.length}`);
			}
		}

		if (sets.length === 0) {
			return setErrorResponse('NO_FIELDS', 'No updatable fields provided', 422);
		}

		values.push(ctx.user.id);
		const sql = `UPDATE fonderie_users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`;

		const [row] = await store.query<{ id: string }>(sql, values);
		if (!row) {
			return setErrorResponse('NOT_FOUND', 'User not found', 404);
		}

		const updated = await findUserById(ctx.user.id, store);
		return setApiResponse(toUserDTO(updated as IUser));
	}
}

export function deleteMeHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		await store.query(
			`UPDATE fonderie_users SET deleted_at = now(), updated_at = now() WHERE id = $1`,
			[ctx.user.id],
		);

		return new Response(null, {
			status: 204,
			headers: {
				'Set-Cookie': [
					'access_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
					'refresh_token=; HttpOnly; SameSite=Strict; Path=/auth/refresh; Max-Age=0',
				].join(', '),
			},
		});
	}
}
