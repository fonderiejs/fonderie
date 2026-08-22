import type { IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseInvitationsReturn {
	invitations: Ref<IInvitationDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
	cancelInvitation: (inviteId: string) => Promise<void>;
}

export function useInvitations(client?: WorkspacesClient): IUseInvitationsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useInvitations');
	const invitations = ref<IInvitationDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.listInvitations({ bust: opts?.force });
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
			await workspaces.invite(entries);
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
			await workspaces.cancelInvitation(inviteId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());

	return { invitations, isLoading, error, refresh, invite, cancelInvitation };
}
