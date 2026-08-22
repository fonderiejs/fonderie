import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IReadOptions,
	IAcceptInvitationResult,
	IApiResponse,
	IInvitationListResult,
	IInviteResult,
	IMemberListResult,
	IRoleListResult,
	IRoleResult,
	IWorkspaceListResult,
	IWorkspaceResult,
	IWorkspaceSettingsResult,
} from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface ICreateWorkspaceInput {
	name: string;
	description?: string;
	type?: string;
}

export interface IUpdateWorkspaceInput {
	name?: string;
	description?: string | null;
	motto?: string | null;
	phone?: string | null;
	businessType?: string | null;
	address?: {
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		zip?: string;
		country?: string;
	} | null;
}

export interface IInviteEntry {
	email: string;
	roleId?: string;
}

export interface IUpdateSettingsInput {
	locale?: string;
	timezone?: string;
	currency?: string;
	dateFormat?: string;
	timeFormat?: string;
}

export interface ICreateRoleInput {
	name: string;
	description?: string;
}

export interface IUpdateRoleInput {
	name?: string;
	description?: string | null;
	active?: boolean;
}

export interface IRolePermissionInput {
	permissionKey: string;
	canCreate?: boolean;
	canRead?: boolean;
	canUpdate?: boolean;
	canDelete?: boolean;
}

export interface IRolePermission {
	permissionKey: string;
	canCreate: boolean;
	canRead: boolean;
	canUpdate: boolean;
	canDelete: boolean;
}

export interface IRolePermissionsResult {
	permissions: IRolePermission[];
}

// ── Workspaces client ────────────────────────────────────────────────────────

export class WorkspacesClient {
	private workspaceId: string | undefined;

	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
	) {}

	setAccessToken(token: string | undefined) {
		this.tokens.set(token);
	}

	// Scopes every subsequent request to this workspace (X-Workspace-ID).
	// Falls back to the caller's personal workspace when unset.
	setWorkspaceId(workspaceId: string | undefined) {
		this.workspaceId = workspaceId;
	}

	// ── Workspace creation + listing ─────────────────────────────────────────────

	listWorkspaces(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWorkspaceListResult>>({
			method: 'GET',
			path: '/workspaces',
			token: this.tokens.get(),
			bust: opts?.bust,
		});
	}

	createWorkspace(input: ICreateWorkspaceInput) {
		return this.http.request<IApiResponse<IWorkspaceResult>>({
			method: 'POST',
			path: '/workspaces',
			body: input,
			token: this.tokens.get(),
		});
	}

	getWorkspace(id: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWorkspaceResult>>({
			method: 'GET',
			path: `/workspaces/${id}`,
			token: this.tokens.get(),
			bust: opts?.bust,
		});
	}

	updateWorkspace(input: IUpdateWorkspaceInput) {
		return this.http.request<IApiResponse<IWorkspaceResult>>({
			method: 'PUT',
			path: '/workspaces',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Personal workspaces can't be archived — the server returns 403 if you try.
	archiveWorkspace() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/workspaces/archive',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	restoreWorkspace() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/workspaces/restore',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Roles ────────────────────────────────────────────────────────────────────

	listRoles(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IRoleListResult>>({
			method: 'GET',
			path: '/workspaces/roles',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	createRole(input: ICreateRoleInput) {
		return this.http.request<IApiResponse<IRoleResult>>({
			method: 'POST',
			path: '/workspaces/roles',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	getRole(roleId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IRoleResult>>({
			method: 'GET',
			path: `/workspaces/roles/${roleId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	updateRole(roleId: string, input: IUpdateRoleInput) {
		return this.http.request<IApiResponse<IRoleResult>>({
			method: 'PUT',
			path: `/workspaces/roles/${roleId}`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeRole(roleId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/workspaces/roles/${roleId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	getRolePermissions(roleId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IRolePermissionsResult>>({
			method: 'GET',
			path: `/workspaces/roles/${roleId}/permissions`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	setRolePermissions(roleId: string, permissions: IRolePermissionInput[]) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/workspaces/roles/${roleId}/permissions`,
			body: { permissions },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Members ──────────────────────────────────────────────────────────────────

	listMembers(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IMemberListResult>>({
			method: 'GET',
			path: '/workspaces/members',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	removeMember(userId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/workspaces/members/${userId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	getMemberRoles(userId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IRoleListResult>>({
			method: 'GET',
			path: `/workspaces/members/${userId}/roles`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	addMemberRole(userId: string, roleId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/workspaces/members/${userId}/roles`,
			body: { roleId },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeMemberRole(userId: string, roleId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/workspaces/members/${userId}/roles/${roleId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Invitations ──────────────────────────────────────────────────────────────

	listInvitations(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IInvitationListResult>>({
			method: 'GET',
			path: '/workspaces/invitations',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	invite(entries: IInviteEntry | IInviteEntry[]) {
		return this.http.request<IApiResponse<IInviteResult>>({
			method: 'POST',
			path: '/workspaces/invitations',
			body: entries,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	cancelInvitation(inviteId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/workspaces/invitations/${inviteId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	acceptInvitation(pin: string) {
		return this.http.request<IApiResponse<IAcceptInvitationResult>>({
			method: 'POST',
			path: '/workspaces/invitations/accept',
			body: { pin },
			token: this.tokens.get(),
		});
	}

	// ── Settings ─────────────────────────────────────────────────────────────────

	getSettings(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWorkspaceSettingsResult>>({
			method: 'GET',
			path: '/workspaces/settings',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	updateSettings(input: IUpdateSettingsInput) {
		return this.http.request<IApiResponse<IWorkspaceSettingsResult>>({
			method: 'PUT',
			path: '/workspaces/settings',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}
}
