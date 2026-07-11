import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IWorkspacesConfig } from './config';
import { EVENT_KEYS } from './config';
import { buildWorkspaceRoutes } from './routes';
import { WorkspaceModel } from './models/workspace.model';
import { RoleModel } from './models/role.model';
import { MemberModel } from './models/member.model';

// Mirror of @fonderie/auth EVENT_KEYS.userRegistered — avoids a runtime
// dependency on the auth package while remaining explicit about the contract.
const AUTH_USER_REGISTERED = 'fonderie.user.registered' as const;

interface UserRegisteredPayload {
	userId: string;
}

export class WorkspacesModule implements IFonderieModule {
	readonly name = '@fonderie/workspaces';
	readonly deps = ['@fonderie/auth', '@fonderie/billing'];

	constructor(
		private store: IStoreAdapter,
		private config: IWorkspacesConfig = {},
		private bus?: EventBus,
	) {}

	install(app: IFonderieApp): void {
		if (this.bus && this.config.personalWorkspace !== false) {
			this.bus.on<UserRegisteredPayload>(
				AUTH_USER_REGISTERED,
				(payload) => this.provisionPersonalWorkspace(payload),
				'workspaces',
			);
		}

		const routes = buildWorkspaceRoutes(this.store, this.config, this.bus);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}

	private async provisionPersonalWorkspace(payload: UserRegisteredPayload): Promise<void> {
		const name = 'My Workspace';
		const slug = `${payload.userId}-personal`;

		let workspaceId: string | undefined;

		await this.store.transaction(async (tx) => {
			const wsModel = new WorkspaceModel(tx);
			const roleModel = new RoleModel(tx);
			const memModel = new MemberModel(tx);

			const ws = await wsModel.createPersonal({ name, slug, ownerId: payload.userId });
			if (!ws) return; // already exists — idempotent replay

			workspaceId = ws.id;

			const adminRole = await roleModel.findSystem('ADMIN');
			if (!adminRole) throw new Error('System ADMIN role not found');

			await memModel.add({
				userId: payload.userId,
				workspaceId: ws.id,
				roleId: adminRole.id,
				confirmed: true,
			});
		});

		if (workspaceId) {
			this.bus
				?.emit(EVENT_KEYS.personalWorkspaceCreated, {
					workspaceId,
					userId: payload.userId,
				})
				.catch(() => {});
		}
	}
}
