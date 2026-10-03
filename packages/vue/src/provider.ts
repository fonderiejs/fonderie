import type { FonderieClient } from '@fonderie/client';
import type { InjectionKey, Plugin, Ref } from 'vue';
import { getCurrentScope, inject, onScopeDispose, provide, readonly, shallowRef } from 'vue';

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
