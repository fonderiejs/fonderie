import type { FonderieClient } from '@fonderie/client';
import type { ReactNode } from 'react';
import { createContext, createElement, useContext } from 'react';

const FonderieContext = createContext<FonderieClient | null>(null);

export interface IFonderieProviderProps {
	client: FonderieClient;
	children?: ReactNode;
}

export function FonderieProvider({ client, children }: IFonderieProviderProps) {
	return createElement(FonderieContext.Provider, { value: client }, children);
}

export function useFonderieClient(): FonderieClient {
	const client = useContext(FonderieContext);
	if (!client) {
		throw new Error(
			'useFonderieClient: no FonderieClient found in context — wrap your app in <FonderieProvider client={...}> from @fonderie/react.',
		);
	}
	return client;
}

// Resolution rule shared by every @fonderie/react-* hook: an explicitly passed
// sub-client always wins over context, and the context read is unconditional
// so the Rules of Hooks hold in both forms.
export function useFonderieSubClient<T>(
	explicit: T | undefined,
	select: (client: FonderieClient) => T,
	hookName: string,
): T {
	const contextClient = useContext(FonderieContext);
	if (explicit) return explicit;
	if (!contextClient) {
		throw new Error(
			`${hookName}: no client — pass one as an argument or wrap your app in <FonderieProvider client={...}> from @fonderie/react.`,
		);
	}
	return select(contextClient);
}
