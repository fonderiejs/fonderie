import type { AuthClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAuthProvidersReturn {
	/** Sign-in methods this deployment can actually honour, e.g. ['email','google']. */
	providers: string[];
	/** Convenience for the common case: should this button be rendered at all? */
	has: (provider: string) => boolean;
	isLoading: boolean;
	error: Error | null;
	refresh: () => Promise<void>;
}

/**
 * Ask the API which sign-in methods it can honour, and render buttons from
 * that — never from a build-time flag.
 *
 * A flag in the frontend stores the same fact the API already holds, and lets
 * the two disagree. The failure is not a broken build: the button renders, the
 * user commits to a redirect, and they land on the provider's error page,
 * which this app has no way to explain. Asking the side that holds the
 * credentials makes that unrepresentable.
 *
 * Starts EMPTY rather than optimistic. A brief moment with no social buttons
 * is invisible; a button that appears and then fails is not.
 */
export function useAuthProviders(client?: AuthClient): IUseAuthProvidersReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useAuthProviders');
	const [providers, setProviders] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const { result } = await auth.providers();
			setProviders(result.providers);
			setError(null);
		} catch (err) {
			// Degrade to email-only rather than guessing: an unreachable API is
			// not evidence that Google works.
			setProviders([]);
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setIsLoading(false);
		}
	}, [auth]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const has = useCallback((provider: string) => providers.includes(provider), [providers]);

	return { providers, has, isLoading, error, refresh };
}
