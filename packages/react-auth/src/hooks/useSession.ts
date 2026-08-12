import type { AuthClient, IUserDTO } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';
import { clearToken, readToken } from '../storage';

export interface IUseSessionReturn {
	user: IUserDTO | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	refresh: () => Promise<void>;
	logout: () => Promise<void>;
}

export function useSession(client: AuthClient): IUseSessionReturn {
	const [user, setUser] = useState<IUserDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const { result } = await client.getUser();
			setUser(result.user);
			setIsAuthenticated(true);
		} catch {
			setUser(null);
			setIsAuthenticated(false);
			client.setAccessToken(undefined);
			clearToken();
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const logout = useCallback(async () => {
		try {
			await client.logout();
		} catch {
			// Session is being torn down regardless of server response.
		}
		client.setAccessToken(undefined);
		clearToken();
		setUser(null);
		setIsAuthenticated(false);
	}, [client]);

	useEffect(() => {
		const token = readToken();
		if (token) client.setAccessToken(token);
		void refresh();
	}, [client, refresh]);

	return { user, isLoading, isAuthenticated, refresh, logout };
}
