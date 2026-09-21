import type { AuthAdminClient, IAdminUserDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref, watch } from 'vue';
import type { Ref } from 'vue';

// One of `email` or `id` (refs, so a search box can drive it); nothing loads
// until one is set.
export function useAdminUser(
	client: AuthAdminClient,
	by: { email?: Ref<string>; id?: Ref<string> },
) {
	const user = ref<IAdminUserDTO | null>(null);
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function wrap(fn: () => Promise<void>) {
		isLoading.value = true;
		error.value = null;
		try {
			await fn();
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoading.value = false;
		}
	}

	async function refresh() {
		const email = by.email?.value;
		const id = by.id?.value;
		if (!email && !id) {
			user.value = null;
			return;
		}
		await wrap(async () => {
			const { result } = id ? await client.getUser(id) : await client.findUser(email as string);
			user.value = result;
		});
	}

	const act =
		(fn: (userId: string) => Promise<{ result: IAdminUserDTO | undefined }>) => async () => {
			if (!user.value) return;
			await wrap(async () => {
				const { result } = await fn(user.value!.id);
				if (result) user.value = result;
			});
		};

	watch([() => by.email?.value, () => by.id?.value], () => void refresh(), { immediate: true });

	return {
		user,
		isLoading,
		error,
		refresh,
		suspend: act((id) => client.suspendUser(id)),
		unsuspend: act((id) => client.unsuspendUser(id)),
		// Signs the user out everywhere.
		revokeSessions: act(async (id) => {
			await client.revokeUserSessions(id);
			return { result: undefined };
		}),
	};
}
