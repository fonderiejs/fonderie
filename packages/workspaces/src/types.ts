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
