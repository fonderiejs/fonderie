import type { IWorkspaceDTO } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseWorkspaceReturn {
	workspace: Ref<IWorkspaceDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read composable for an explicit workspace id (admin/cross-workspace
// lookups). Current-workspace mutations live in useWorkspaceProfile - they act
// on the client's workspace scope, not on this id.
export function useWorkspace(id: MaybeRefOrGetter<string>): IUseWorkspaceReturn;
export function useWorkspace(
	client: WorkspacesClient | undefined,
	id: MaybeRefOrGetter<string>,
): IUseWorkspaceReturn;
export function useWorkspace(
	clientOrId: WorkspacesClient | MaybeRefOrGetter<string> | undefined,
	maybeId?: MaybeRefOrGetter<string>,
): IUseWorkspaceReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const id = firstIsClient ? (maybeId as MaybeRefOrGetter<string>) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useWorkspace');
	const workspace = ref<IWorkspaceDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.getWorkspace(toValue(id), { bust: opts?.force });
			workspace.value = result.workspace;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => toValue(id),
		() => void refresh(),
	);

	return { workspace, isLoading, error, refresh };
}
