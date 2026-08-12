import type { IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useInvitations(client: WorkspacesClient) {
	const invitations = ref<IInvitationDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listInvitations();
			invitations.value = result.invitations;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function invite(entries: IInviteEntry | IInviteEntry[]) {
		error.value = null;
		try {
			await client.invite(entries);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function cancelInvitation(inviteId: string) {
		error.value = null;
		try {
			await client.cancelInvitation(inviteId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { invitations, isLoading, error, refresh, invite, cancelInvitation };
}
