import type { FonderieClient, UiT } from '@fonderie/client';
import { createUiT, detectDeviceLocale, uiLocaleFor } from '@fonderie/client';
import type { ReactNode } from 'react';
import { createContext, createElement, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

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

/**
 * Anything scoped to a workspace that says when it changes: the FonderieClient
 * itself, or a workspace-scoped sub-client such as `client.billing`.
 */
export interface IWorkspaceScoped {
	getWorkspaceId(): string | undefined;
	onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void;
}

const noop = () => {};

function isWorkspaceScoped(value: unknown): value is IWorkspaceScoped {
	const v = value as Partial<IWorkspaceScoped> | null | undefined;
	return typeof v?.getWorkspaceId === 'function' && typeof v?.onWorkspaceChange === 'function';
}

/**
 * The current workspace id, re-rendering when it changes. Pass the sub-client a
 * hook reads from (so an explicitly passed client is followed too); with no
 * argument it follows the <FonderieProvider> client. Hooks that load
 * per-workspace data put this in their load effect's dependencies, so switching
 * workspace re-reads instead of showing the previous workspace's data. A source
 * that cannot report changes (an older client) reads as undefined — the hook
 * then never re-reads on a switch, exactly as before.
 */
export function useWorkspaceId(source?: unknown): string | undefined {
	const contextClient = useContext(FonderieContext);
	const scoped = source ?? contextClient;
	const target = isWorkspaceScoped(scoped) ? scoped : null;
	const subscribe = useCallback(
		(onChange: () => void) => (target ? target.onWorkspaceChange(onChange) : noop),
		[target],
	);
	const read = useCallback(() => target?.getWorkspaceId(), [target]);
	return useSyncExternalStore(subscribe, read, read);
}

const DEVICE_LOCALE = detectDeviceLocale();
const NO_SUBSCRIBE = () => () => {};

/**
 * The prebuilt screens' translator, in the app's UI language: the language of
 * the client a screen was handed (`source`, any sub-client works), else of the
 * <FonderieProvider> client, else the device's. Follows client.setLocale()
 * live. `locale` overrides it for one screen.
 *
 *   const t = useUiT(client);  t('auth.login.title')
 */
export function useUiT(source?: object, locale?: string): UiT {
	const tag = useUiLocale(source, locale);
	return useMemo(() => createUiT(tag), [tag]);
}

/**
 * The app's UI language as a BCP 47 tag ('fr-CA', 'zh-Hant'…), found the same
 * way as useUiT — for formatting dates, amounts and names the way it writes them.
 */
export function useUiLocale(source?: object, locale?: string): string {
	const contextClient = useContext(FonderieContext);
	const src = uiLocaleFor(source) ?? uiLocaleFor(contextClient ?? undefined);
	const subscribe = useCallback((onChange: () => void) => (src ? src.on(onChange) : NO_SUBSCRIBE()), [src]);
	const tag = useSyncExternalStore(subscribe, () => src?.get() ?? DEVICE_LOCALE, () => src?.get() ?? DEVICE_LOCALE);
	return locale ?? tag;
}
