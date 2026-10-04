export type WorkspaceType = 'ORGANIZATION' | 'PERSONAL' | 'TEAM' | 'COMMUNITY' | 'VENDOR';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type BusinessType = 'SOLE_PROP' | 'PARTNERSHIP' | 'LLC' | 'INC' | 'NONPROFIT' | 'COOPERATIVE';

export interface IWorkspaceAddress {
	line1?: string;
	line2?: string;
	city?: string;
	state?: string;
	zip?: string;
	country?: string;
}

export interface IWorkspace {
	id: string;
	name: string;
	slug: string;
	type: WorkspaceType;
	description: string | null;
	motto: string | null;
	phone: string | null;
	businessType: string | null;
	address: IWorkspaceAddress | null;
	/**
	 * @deprecated Not the workspace's billing plan. Set to 'free' when the
	 * workspace is created and never maintained — nothing writes it when the
	 * workspace subscribes, upgrades or cancels. Read the subscription from
	 * @fonderie/billing instead (GET /billing/subscription with the
	 * X-Workspace-ID header; `useSubscription()` in the frontend packages).
	 */
	plan: string;
	ownerId: string;
	isPersonal: boolean;
	archivedAt: string | null;
	archivedBy: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface IRole {
	id: string;
	name: string;
	isSystem: boolean;
	active: boolean;
	description: string | null;
	workspaceId: string | null;
}

export interface IMember {
	userId: string;
	workspaceId: string;
	roleId: string;
	roleName: string;
	confirmed: boolean;
	createdAt: string;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
	profileImageUrl: string | null;
	/** Every role this person holds here, earliest first (listMembers only). */
	roles?: IMemberRole[];
	/** The workspace owner (listMembers only). */
	isOwner?: boolean;
	/** The owner, or a holder of a manager system role (listMembers only). */
	isManager?: boolean;
}

export interface IMemberRole {
	id: string;
	name: string;
	isSystem: boolean;
}

export interface IInvitation {
	id: string;
	workspaceId: string;
	email: string;
	roleId: string;
	token: string;
	pin: string | null;
	status: InvitationStatus;
	expiresAt: string;
	createdAt: string;
}

export interface IWorkspaceSettings {
	locale: string;
	timezone: string;
	currency: string;
	dateFormat: string;
	timeFormat: string;
}
