export type {
	ICreateRoleInput,
	ICreateWorkspaceInput,
	IInvitationDTO,
	IInviteEntry,
	IMemberDTO,
	IRoleDTO,
	IRolePermission,
	IRolePermissionInput,
	IUpdateRoleInput,
	IUpdateSettingsInput,
	IUpdateWorkspaceInput,
	IWorkspaceAddressDTO,
	IWorkspaceDTO,
	IWorkspaceSettingsDTO,
	WorkspacesClient,
} from '@fonderie/client';

export { FonderieApiError } from '@fonderie/client';
export type { IUseRolePermissionsReturn } from './composables';
export {
	useAcceptInvitation,
	useCreateWorkspace,
	useInvitations,
	useMemberRoles,
	useMembers,
	useRemoveMember,
	useRolePermissions,
	useRoles,
	useSetRolePermissions,
	useUpdateRole,
	useWorkspaceProfile,
	useWorkspaceSettings,
	useWorkspaces,
} from './composables';
