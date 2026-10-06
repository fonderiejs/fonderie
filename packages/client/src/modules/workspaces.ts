import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IOwnershipOfferDTO,
	IDeletedRoleDTO,
	IRestoredRoleResult,
	IReadOptions,
	IAcceptInvitationInput,
	IAcceptInvitationResult,
	IApiResponse,
	IInvitationListResult,
	IInvitationResult,
	IMyPermissionsResult,
	IPermissionCatalogResult,
	IRoleDeleteResult,
	IInviteResult,
	IMemberListResult,
	IRoleListResult,
	IRoleResult,
	IWorkspaceListResult,
	IWorkspaceResult,
	IWorkspaceSettingsResult,
} from '../types';
import { WorkspaceScope } from '../workspace-scope';

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
	/** The sector / trade, as the app's own key: lowercase letters, digits, '_' or '-' (≤ 40). Null clears it. */
	industry?: string | null;
	address?: {
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		zip?: string;
		country?: string;
		/** Door / buzzer / gate code (≤ 20). */
		accessCode?: string | null;
	} | null;
	legalName?: string | null;
	email?: string | null;
	website?: string | null;
	/** The logo's URL — typically what client.media returned for the upload. */
	logoUrl?: string | null;
	/** Replaces the list. Each is checked against its country's rules (422 names the field). */
	taxRegistrations?: Array<{
		country: string;
		type: string;
		/** Optional when `rate` is given — a business may charge a tax before its number arrives. */
		number?: string | null;
		region?: string | null;
		label?: string | null;
		/** The percent charged (0–100, at most 3 decimals: 9.975). */
		rate?: number | null;
	}>;
	/** The languages the business serves customers in, e.g. ['en-CA', 'fr-CA']. */
	languages?: string[];
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
	/**
	 * What goes before a document's number, per kind: { invoice: 'ACME', job: 'ACME-JOB' }.
	 * Kinds are 1–20 lowercase letters or '_' (≤ 10 kinds); prefixes ≤ 10 of A–Z, 0–9, '-'
	 * (upper-cased by the server; '' drops one). Replaces the map; null clears it.
	 */
	documentPrefixes?: Record<string, string> | null;
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
	// Created on first use, so an instance built without the constructor (a
	// test double from Object.create(prototype)) still works.
	private scope?: WorkspaceScope;

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
		this.workspaceScope().set(workspaceId);
	}

	// The workspace this client is scoped to (X-Workspace-ID).
	getWorkspaceId(): string | undefined {
		return this.workspaceId;
	}

	// Called whenever setWorkspaceId changes the workspace, so a screen showing
	// this workspace's data re-reads on a switch. Returns the unsubscribe.
	onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void {
		return this.workspaceScope().on(listener);
	}

	private workspaceScope(): WorkspaceScope {
		if (!this.scope) this.scope = new WorkspaceScope();
		return this.scope;
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
			path: `/workspaces/${encodeURIComponent(id)}`,
			token: this.tokens.get(),
			bust: opts?.bust,
		});
	}

	// The workspace this client is scoped to (the selected one, or the personal
	// workspace when none is selected).
	getCurrentWorkspace(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWorkspaceResult>>({
			method: 'GET',
			path: '/workspaces/current',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// What the signed-in member may do in the selected workspace — the one read
	// a client gates its UI on (usePermissions / useCan).
	getMyPermissions(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IMyPermissionsResult>>({
			method: 'GET',
			path: '/workspaces/current/permissions',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// The resources the app checks — a role editor's switch grid.
	getPermissionCatalog(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IPermissionCatalogResult>>({
			method: 'GET',
			path: '/workspaces/permissions/catalog',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
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
			path: `/workspaces/roles/${encodeURIComponent(roleId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	updateRole(roleId: string, input: IUpdateRoleInput) {
		return this.http.request<IApiResponse<IRoleResult>>({
			method: 'PUT',
			path: `/workspaces/roles/${encodeURIComponent(roleId)}`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Resolves with how many members held the role and how many of them moved
	// to the default role (it was their only one) — say so before confirming.
	removeRole(roleId: string) {
		return this.http.request<IApiResponse<IRoleDeleteResult>>({
			method: 'DELETE',
			path: `/workspaces/roles/${encodeURIComponent(roleId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── The undo bin: deleted roles, restorable for 30 days ──────────────
	listDeletedRoles(opts?: IReadOptions) {
		return this.http.request<IApiResponse<{ roles: IDeletedRoleDTO[] }>>({
			method: 'GET',
			path: '/workspaces/roles/bin',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	restoreRole(id: string) {
		return this.http.request<IApiResponse<IRestoredRoleResult>>({
			method: 'POST',
			path: `/workspaces/roles/bin/${encodeURIComponent(id)}/restore`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Gone for good — the workspace owner only.
	purgeDeletedRole(id: string) {
		return this.http.request<undefined>({
			method: 'DELETE',
			path: `/workspaces/roles/bin/${encodeURIComponent(id)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	getRolePermissions(roleId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IRolePermissionsResult>>({
			method: 'GET',
			path: `/workspaces/roles/${encodeURIComponent(roleId)}/permissions`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	setRolePermissions(roleId: string, permissions: IRolePermissionInput[]) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/workspaces/roles/${encodeURIComponent(roleId)}/permissions`,
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
			path: `/workspaces/members/${encodeURIComponent(userId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	getMemberRoles(userId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IRoleListResult>>({
			method: 'GET',
			path: `/workspaces/members/${encodeURIComponent(userId)}/roles`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	addMemberRole(userId: string, roleId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/workspaces/members/${encodeURIComponent(userId)}/roles`,
			body: { roleId },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeMemberRole(userId: string, roleId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/workspaces/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Owner only: make a member a manager, or take it back.
	setManager(userId: string) {
		return this.http.request<IApiResponse<void>>({
			method: 'POST',
			path: `/workspaces/members/${encodeURIComponent(userId)}/manager`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	unsetManager(userId: string) {
		return this.http.request<IApiResponse<void>>({
			method: 'DELETE',
			path: `/workspaces/members/${encodeURIComponent(userId)}/manager`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Owner only: someone the velocity brake paused (deleted too much too fast)
	// may delete again.
	releaseBrake(userId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/workspaces/members/${encodeURIComponent(userId)}/brake`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Owner only, after a step-up (auth.stepUp): OFFER the workspace to another
	// member. It moves when they accept (acceptOwnership); the previous owner
	// stays as a manager. 403 STEP_UP_REQUIRED without a fresh proof.
	transferOwnership(userId: string) {
		return this.http.request<IApiResponse<{ offer: IOwnershipOfferDTO }>>({
			method: 'POST',
			path: '/workspaces/transfer-ownership',
			body: { userId },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// The open ownership offer of the selected workspace, if any.
	getOwnershipOffer(opts?: IReadOptions) {
		return this.http.request<IApiResponse<{ offer: IOwnershipOfferDTO | null }>>({
			method: 'GET',
			path: '/workspaces/transfer-ownership',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// The member it is offered to takes the workspace.
	acceptOwnership() {
		return this.http.request<IApiResponse<{ previousOwnerId: string }>>({
			method: 'POST',
			path: '/workspaces/transfer-ownership/accept',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	declineOwnership() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/workspaces/transfer-ownership/decline',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Owner only: take the offer back.
	withdrawOwnershipOffer() {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: '/workspaces/transfer-ownership',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Leave the selected workspace. The owner must transfer ownership first.
	leaveWorkspace() {
		return this.http.request<IApiResponse<void>>({
			method: 'POST',
			path: '/workspaces/leave',
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
			path: `/workspaces/invitations/${encodeURIComponent(inviteId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	resendInvitation(inviteId: string) {
		return this.http.request<IApiResponse<IInvitationResult>>({
			method: 'POST',
			path: `/workspaces/invitations/${encodeURIComponent(inviteId)}/resend`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Accept with the link's token ({ token }) or the 6-digit PIN from the email
	// ({ pin }, or a bare string). The PIN only redeems an invitation addressed
	// to the signed-in account's email; the token works for any account.
	acceptInvitation(code: string | IAcceptInvitationInput) {
		const body = typeof code === 'string' ? { pin: code } : code;
		return this.http.request<IApiResponse<IAcceptInvitationResult>>({
			method: 'POST',
			path: '/workspaces/invitations/accept',
			body,
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
