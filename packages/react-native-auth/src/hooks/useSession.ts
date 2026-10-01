import { isSessionRefusal, type AuthClient, type IUserDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';
import { clearToken, readToken } from '../storage';

export interface IUseSessionReturn {
	user: IUserDTO | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	refresh: () => Promise<void>;
	logout: (refreshToken?: string) => Promise<void>;
}

export function useSession(client?: AuthClient): IUseSessionReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useSession');
	const [user, setUser] = useState<IUserDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const { result } = await auth.getUser();
			setUser(result.user);
			setIsAuthenticated(true);
		} catch (err) {
			// Only the server refusing the session signs out. Offline, a 5xx or a
			// rate limit keeps it: the user stays signed in and the next refresh
			// tries again (docs/SESSION-DESIGN.md, Phase 4).
			if (isSessionRefusal(err)) {
				setUser(null);
				setIsAuthenticated(false);
				auth.setAccessToken(undefined);
				await clearToken();
			} else {
				setIsAuthenticated(auth.hasAccessToken());
			}
		} finally {
			setIsLoading(false);
		}
	}, [auth]);

	const logout = useCallback(async (refreshToken?: string) => {
		try {
			await auth.logout(refreshToken);
		} catch {
			// Session is being torn down regardless of server response.
		}
		auth.setAccessToken(undefined);
		await clearToken();
		setUser(null);
		setIsAuthenticated(false);
	}, [auth]);

	useEffect(() => {
		readToken().then((token) => {
			if (token) auth.setAccessToken(token);
			void refresh();
		});
	}, [auth, refresh]);

	return { user, isLoading, isAuthenticated, refresh, logout };
}
