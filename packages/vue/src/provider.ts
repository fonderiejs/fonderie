import type { FonderieClient } from '@fonderie/client';
import type { InjectionKey, Plugin } from 'vue';
import { inject, provide } from 'vue';

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
