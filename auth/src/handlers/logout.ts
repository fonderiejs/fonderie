import type { IFonderieContext } from '@fonderie-js/core';

export function logoutHandler() {
	return async (_ctx: IFonderieContext): Promise<Response> => {
		return Response.json(
			{ ok: true },
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
	}
}
