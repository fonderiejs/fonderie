import type {
	AdminClient,
	IAdminEnrollment,
	IAdminSecondFactor,
	IAdminSession,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// The operator sign-in flow. The session itself is an HttpOnly cookie the
// browser holds — this composable only ever sees its state.
export function useAdminSession(client: AdminClient) {
	const session = ref<IAdminSession | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const toError = (err: unknown) =>
		err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.session();
			session.value = result;
		} catch (err) {
			error.value = toError(err);
		} finally {
			isLoading.value = false;
		}
	}

	async function run<T>(fn: () => Promise<{ result: T }>, keep = true): Promise<T> {
		error.value = null;
		try {
			const { result } = await fn();
			if (keep)
				session.value = {
					...(session.value ?? { state: 'signed-out', operator: null }),
					...(result as object),
				} as IAdminSession;
			return result;
		} catch (err) {
			const e = toError(err);
			error.value = e;
			throw e;
		}
	}

	void refresh();

	return {
		session,
		isLoading,
		error,
		refresh,
		/** One-time: `rootClient` must carry the root adminToken. */
		claim: (
			rootClient: AdminClient,
			input: { email: string; password: string; name?: string },
		): Promise<IAdminSession> => run(() => rootClient.claim(input)),
		login: (input: { email: string; password: string }): Promise<IAdminSession> =>
			run(() => client.login(input)),
		enrollment: (): Promise<IAdminEnrollment> => run(() => client.enrollment(), false),
		confirmEnrollment: (code: string): Promise<IAdminSession> =>
			run(() => client.confirmEnrollment(code)),
		verify: (factor: IAdminSecondFactor): Promise<IAdminSession> =>
			run(() => client.verify(factor)),
		stepUp: async (factor: IAdminSecondFactor): Promise<void> => {
			await run(() => client.stepUp(factor));
		},
		logout: async (): Promise<void> => {
			await run(() => client.logout(), false);
			session.value = {
				state: 'signed-out',
				operator: null,
				claimable: session.value?.claimable ?? false,
			};
		},
		inspectLink: (token: string) => run(() => client.inspectLink(token), false),
		redeemLink: (input: {
			token: string;
			password: string;
			name?: string;
		}): Promise<IAdminSession> => run(() => client.redeemLink(input)),
	};
}
