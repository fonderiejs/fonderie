import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { toUserDTO }              from '../dtos/user';
import type { IUser }             from '../types';
import { UserModel }              from '../models/user.model';
import type { IUserUpdateFields } from '../models/user.model';

export function userController(store: IStoreAdapter) {
	const users = new UserModel(store);

	return {
		me: async (ctx: IFonderieContext): Promise<Response> => {
			if (!ctx.user) {
				return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
			}

			const user = await users.findById(ctx.user.id);
			if (!user) {
				return setErrorResponse(404, 'NOT_FOUND', 'User not found');
			}

			return setApiResponse(200, 'USER_FETCHED', 'User successfully fetched.', { user: toUserDTO(user) });
		},

		updateMe: async (ctx: IFonderieContext): Promise<Response> => {
			if (!ctx.user) {
				return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;

			const fields: IUserUpdateFields = {};
			const keys: (keyof IUserUpdateFields)[] = [
				'firstName', 'lastName', 'phoneNumber', 'avatarUrl', 'locale', 'timezone', 'preferences',
			];

			for (const key of keys) {
				if (body?.[key] !== undefined) {
					(fields as Record<string, unknown>)[key] = body[key];
				}
			}

			if (Object.keys(fields).length === 0) {
				return setErrorResponse(422, 'NO_FIELDS', 'No updatable fields provided');
			}

			const row = await users.update(ctx.user.id, fields);
			if (!row) {
				return setErrorResponse(404, 'NOT_FOUND', 'User not found');
			}

			const updated = await users.findById(ctx.user.id);
			return setApiResponse(200, 'ACCOUNT_UPDATED', 'Account successfully updated.', {
				user: toUserDTO(updated as IUser),
			});
		},

		deleteMe: async (ctx: IFonderieContext): Promise<Response> => {
			if (!ctx.user) {
				return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
			}

			await users.softDelete(ctx.user.id);

			return Response.json(
				{ reason: 'ACCOUNT_DELETED', explanation: 'Account successfully deleted.' },
				{
					status: 200,
					headers: {
						'Set-Cookie': [
							'access_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
							'refresh_token=; HttpOnly; SameSite=Strict; Path=/auth/refresh; Max-Age=0',
						].join(', '),
					},
				},
			);
		},
	};
}
