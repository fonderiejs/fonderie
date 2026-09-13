import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseAuthProvidersReturn {
	/** Sign-in methods this deployment can honour, e.g. ['email','google']. */
	providers: Ref<string[]>;
	/** The common case: should this button be rendered at all? */
	has: (provider: string) => boolean;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | Error | null>;
	refresh: () => Promise<void>;
}

// Ask the API which sign-in methods it can honour, and render buttons from
// that — never from a build-time flag. A flag stores the same fact the API
// already holds and lets the two disagree; the failure is a user committing to
// a redirect and landing on the provider's error page, which this app cannot
// explain. Same contract as react-auth's useAuthProviders.
//
// Starts EMPTY rather than optimistic: a brief moment with no social buttons is
// invisible, a button that appears and then fails is not.
export function useAuthProviders(client?: AuthClient): IUseAuthProvidersReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useAuthProviders');
	const providers = ref<string[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | Error | null>(null);

	const refresh = async (): Promise<void> => {
		isLoading.value = true;
		try {
			const { result } = await auth.providers();
			providers.value = result.providers;
			error.value = null;
		} catch (err) {
			// Degrade to email-only rather than guessing: an unreachable API is
			// not evidence that a provider works.
			providers.value = [];
			error.value = err instanceof Error ? err : new Error(String(err));
		} finally {
			isLoading.value = false;
		}
	};

	onMounted(() => {
		void refresh();
	});

	return {
		providers,
		has: (provider: string) => providers.value.includes(provider),
		isLoading,
		error,
		refresh,
	};
}
