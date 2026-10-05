import type { FonderieClient, IApiErrorLike, UiT } from '@fonderie/client';
import { createUiT, detectDeviceLocale, localizeApiError, uiLocaleFor } from '@fonderie/client';
import type { InjectionKey, MaybeRefOrGetter, Plugin, Ref } from 'vue';
import { computed, getCurrentScope, inject, onScopeDispose, provide, readonly, shallowRef, toValue } from 'vue';

export const FONDERIE_INJECTION_KEY: InjectionKey<FonderieClient> = Symbol('fonderie-client');

// Call inside a setup() (typically the root component) to make the client
// available to every @fonderie/vue-* composable below it.
export function provideFonderie(client: FonderieClient): void {
	provide(FONDERIE_INJECTION_KEY, client);
}

// App-level alternative: app.use(FonderiePlugin, client)
export const FonderiePlugin: Plugin<[FonderieClient]> = {
	install(app, client) {
		app.provide(FONDERIE_INJECTION_KEY, client);
	},
};

export function useFonderieClient(): FonderieClient {
	const client = inject(FONDERIE_INJECTION_KEY, null);
	if (!client) {
		throw new Error(
			'useFonderieClient: no FonderieClient provided — call provideFonderie(client) in a root setup() or app.use(FonderiePlugin, client) from @fonderie/vue.',
		);
	}
	return client;
}

// Resolution rule shared by every @fonderie/vue-* composable: an explicitly
// passed sub-client always wins; the inject() is unconditional so both forms
// run inside setup() the same way.
export function useFonderieSubClient<T>(
	explicit: T | undefined,
	select: (client: FonderieClient) => T,
	composableName: string,
): T {
	const contextClient = inject(FONDERIE_INJECTION_KEY, null);
	if (explicit) return explicit;
	if (!contextClient) {
		throw new Error(
			`${composableName}: no client — pass one as an argument, or call provideFonderie(client) / app.use(FonderiePlugin, client) from @fonderie/vue.`,
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

function isWorkspaceScoped(value: unknown): value is IWorkspaceScoped {
	const v = value as Partial<IWorkspaceScoped> | null | undefined;
	return typeof v?.getWorkspaceId === 'function' && typeof v?.onWorkspaceChange === 'function';
}

/**
 * The current workspace id as a Ref that updates when it changes. Pass the
 * sub-client a composable reads from (so an explicitly passed client is
 * followed too); with no argument it follows the provided client. Composables
 * that load per-workspace data watch it and re-read on a switch. A source that
 * cannot report changes (an older client) reads as undefined and never
 * changes — exactly the old behaviour. Call inside setup().
 */
export function useWorkspaceId(source?: unknown): Readonly<Ref<string | undefined>> {
	const contextClient = inject(FONDERIE_INJECTION_KEY, null);
	const scoped = source ?? contextClient;
	const target = isWorkspaceScoped(scoped) ? scoped : null;
	const id = shallowRef<string | undefined>(target?.getWorkspaceId());
	if (target) {
		const off = target.onWorkspaceChange((next) => {
			id.value = next;
		});
		if (getCurrentScope()) onScopeDispose(off);
	}
	return readonly(id);
}

const DEVICE_LOCALE = detectDeviceLocale();

/**
 * The prebuilt screens' translator, in the app's UI language: the language of
 * the client a screen was handed (`source`, any sub-client works), else of the
 * provided client, else the device's. Follows client.setLocale() live — a
 * render that calls t() re-renders when the language changes. `locale`
 * overrides it for one screen. Call inside setup().
 *
 *   const t = useUiT(props.client);  h('h1', t('auth.login.title'))
 */
export function useUiT(source?: object, locale?: MaybeRefOrGetter<string | undefined>): UiT {
	const tag = useUiLocale(source, locale);
	const t = computed(() => createUiT(tag.value));
	return (key, params) => t.value(key, params);
}

/**
 * The app's UI language as a BCP 47 tag ('fr-CA', 'zh-Hant'…), found the same
 * way as useUiT and kept current — for formatting dates, amounts and names the
 * way it writes them. Call inside setup().
 */
export function useUiLocale(source?: object, locale?: MaybeRefOrGetter<string | undefined>): Readonly<Ref<string>> {
	const contextClient = inject(FONDERIE_INJECTION_KEY, null);
	const src = uiLocaleFor(source) ?? uiLocaleFor(contextClient ?? undefined);
	const tag = shallowRef(src?.get() ?? DEVICE_LOCALE);
	if (src) {
		const off = src.on((next) => {
			tag.value = next;
		});
		if (getCurrentScope()) onScopeDispose(off);
	}
	return computed(() => toValue(locale) ?? tag.value);
}

/**
 * A refused request as text in the app's UI language — what a screen shows
 * instead of the server's English `explanation` (see localizeApiError). Reads
 * reactive state, so a render calling it follows a language change. Call
 * inside setup().
 */
export function useUiError(source?: object, locale?: MaybeRefOrGetter<string | undefined>): (error: IApiErrorLike | null | undefined) => string {
	const tag = useUiLocale(source, locale);
	return (error) => localizeApiError(error, tag.value);
}
