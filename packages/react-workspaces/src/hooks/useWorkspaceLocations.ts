import type {
	FonderieApiError,
	IUpdateWorkspaceLocationInput,
	IWorkspaceLocationDTO,
	IWorkspaceLocationInput,
	WorkspacesClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

import { WORKSPACE_CONTACTS_KEY, fetchWorkspaceContacts } from './useWorkspaceContacts';

export interface IUseWorkspaceLocationsReturn {
	/** The head office first; archived ones last (`isArchived`), restorable. */
	locations: IWorkspaceLocationDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createLocation: (input: IWorkspaceLocationInput) => Promise<void>;
	updateLocation: (locationId: string, input: IUpdateWorkspaceLocationInput) => Promise<void>;
	/** The head office cannot be archived: 409 HEAD_OFFICE_ARCHIVE — move it first. */
	archiveLocation: (locationId: string) => Promise<void>;
	restoreLocation: (locationId: string) => Promise<void>;
}

const NONE: IWorkspaceLocationDTO[] = [];

// The selected workspace's locations (the head office's address is the
// workspace's address). Shares its read with useWorkspaceContacts.
export function useWorkspaceLocations(client?: WorkspacesClient): IUseWorkspaceLocationsReturn {
	const api = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceLocations');
	const q = useScopedQuery(api, WORKSPACE_CONTACTS_KEY, (bust) => fetchWorkspaceContacts(api, bust));
	const w = useWrite(q.refresh);
	const createLocation = useCallback(
		(input: IWorkspaceLocationInput) => w.run(async () => void (await api.createLocation(input))),
		[api, w.run],
	);
	const updateLocation = useCallback(
		(locationId: string, input: IUpdateWorkspaceLocationInput) => w.run(async () => void (await api.updateLocation(locationId, input))),
		[api, w.run],
	);
	const archiveLocation = useCallback((locationId: string) => w.run(async () => void (await api.archiveLocation(locationId))), [api, w.run]);
	const restoreLocation = useCallback((locationId: string) => w.run(async () => void (await api.restoreLocation(locationId))), [api, w.run]);
	return {
		locations: q.data?.locations ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		createLocation,
		updateLocation,
		archiveLocation,
		restoreLocation,
	};
}
