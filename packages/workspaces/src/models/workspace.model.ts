import type { IStoreAdapter } from '@fonderie/store';

import type { IWorkspace, IWorkspaceSettings } from '../types';
import {
	findWorkspaceById,
	findWorkspacesByUserId,
	createWorkspace,
	createPersonalWorkspace,
	findPersonalWorkspace,
	updateWorkspace,
	archiveWorkspace,
	restoreWorkspace,
	getWorkspaceSettings,
	updateWorkspaceSettings,
} from '../services/workspaces';

export class WorkspaceModel {
	constructor(private readonly store: IStoreAdapter) {}

	findById(id: string): Promise<IWorkspace | null> {
		return findWorkspaceById(id, this.store);
	}

	findByUserId(userId: string): Promise<IWorkspace[]> {
		return findWorkspacesByUserId(userId, this.store);
	}

	create(opts: Parameters<typeof createWorkspace>[0]): Promise<IWorkspace> {
		return createWorkspace(opts, this.store);
	}

	createPersonal(opts: Parameters<typeof createPersonalWorkspace>[0]): Promise<IWorkspace | null> {
		return createPersonalWorkspace(opts, this.store);
	}

	findPersonal(userId: string): Promise<IWorkspace | null> {
		return findPersonalWorkspace(userId, this.store);
	}

	update(id: string, opts: Parameters<typeof updateWorkspace>[1]): Promise<IWorkspace | null> {
		return updateWorkspace(id, opts, this.store);
	}

	archive(id: string, byUser: string): Promise<void> {
		return archiveWorkspace(id, byUser, this.store);
	}

	restore(id: string): Promise<void> {
		return restoreWorkspace(id, this.store);
	}

	getSettings(id: string): Promise<IWorkspaceSettings> {
		return getWorkspaceSettings(id, this.store);
	}

	updateSettings(id: string, settings: Partial<IWorkspaceSettings>): Promise<IWorkspaceSettings> {
		return updateWorkspaceSettings(id, settings, this.store);
	}
}
