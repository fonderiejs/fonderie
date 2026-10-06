import type {
	FonderieApiError,
	IUpdateWorkspaceLocationInput,
	IWorkspaceLocationDTO,
	IWorkspaceLocationInput,
	WorkspacesClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

import { WORKSPACE_CONTACTS_KEY, fetchWorkspaceContacts } from './useWorkspaceContacts';

export interface IUseWorkspaceLocationsReturn {
	/** The head office first; archived ones last (`isArchived`), restorable. */
	locations: Ref<IWorkspaceLocationDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createLocation: (input: IWorkspaceLocationInput) => Promise<void>;
	updateLocation: (locationId: string, input: IUpdateWorkspaceLocationInput) => Promise<void>;
	/** The head office cannot be archived: 409 HEAD_OFFICE_ARCHIVE — move it first. */
	archiveLocation: (locationId: string) => Promise<void>;
	restoreLocation: (locationId: string) => Promise<void>;
}

// The selected workspace's locations (the head office's address is the
// workspace's address). Shares its read with useWorkspaceContacts.
export function useWorkspaceLocations(client?: WorkspacesClient): IUseWorkspaceLocationsReturn {
	const api = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceLocations');
	const q = useScopedQuery(api, WORKSPACE_CONTACTS_KEY, (bust) => fetchWorkspaceContacts(api, bust));
	const w = useWrite(() => q.refresh());
	return {
		locations: computed(() => q.data.value?.locations ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		createLocation: (input) => w.run(async () => void (await api.createLocation(input))),
		updateLocation: (locationId, input) => w.run(async () => void (await api.updateLocation(locationId, input))),
		archiveLocation: (locationId) => w.run(async () => void (await api.archiveLocation(locationId))),
		restoreLocation: (locationId) => w.run(async () => void (await api.restoreLocation(locationId))),
	};
}
