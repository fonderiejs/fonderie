import type {
	AuthClient,
	IUpdatePreferencesInput,
	IUpdateProfileInput,
	IUserDTO,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseProfileReturn {
	user: Ref<IUserDTO | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateProfile: (input: IUpdateProfileInput) => Promise<IUserDTO>;
	updatePreferences: (input: IUpdatePreferencesInput) => Promise<IUserDTO>;
	// Email/phone changes re-fetch the profile (their endpoints don't return it).
	updateEmail: (email: string) => Promise<void>;
	updatePhone: (phone: string) => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useProfile(client?: AuthClient): IUseProfileReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useProfile');
	const user = ref<IUserDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await auth.getUser({ bust: opts?.force });
			user.value = result.user;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function mutate<T>(op: () => Promise<T>): Promise<T> {
		error.value = null;
		try {
			return await op();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	function updateProfile(input: IUpdateProfileInput) {
		return mutate(async () => {
			const { result } = await auth.updateProfile(input);
			user.value = result.user;
			return result.user;
		});
	}

	function updatePreferences(input: IUpdatePreferencesInput) {
		return mutate(async () => {
			const { result } = await auth.updatePreferences(input);
			user.value = result.user;
			return result.user;
		});
	}

	function updateEmail(email: string) {
		return mutate(async () => {
			await auth.updateEmail(email);
			await refresh();
		});
	}

	function updatePhone(phone: string) {
		return mutate(async () => {
			await auth.updatePhone(phone);
			await refresh();
		});
	}

	onMounted(() => void refresh());

	return { user, refresh, updateProfile, updatePreferences, updateEmail, updatePhone, isLoading, error };
}
