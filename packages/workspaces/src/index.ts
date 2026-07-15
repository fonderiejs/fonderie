export { WorkspacesModule } from './module';
export type { IWorkspacesConfig, WorkspacesMessageKey, WorkspacesEventKey } from './config';
export { MESSAGE_KEYS, EVENT_KEYS } from './config';
export type {
	WorkspaceType,
	InvitationStatus,
	IWorkspace,
	IRole,
	IMember,
	IInvitation,
	IWorkspaceSettings,
} from './types';
export type {
	IWorkspaceDTO,
	IRoleDTO,
	IMemberDTO,
	IInvitationDTO,
	IWorkspaceSettingsDTO,
} from './dtos/workspace';
export {
	toWorkspaceDTO,
	toRoleDTO,
	toMemberDTO,
	toInvitationDTO,
	toSettingsDTO,
} from './dtos/workspace';
export { withWorkspace } from './middlewares/workspace-context';
export { requireWorkspace } from './middlewares/require-workspace';

// Request validation — enforced contract for body-taking routes; exported
// for docs generation and typed clients.
export * as schemas from './schemas';
