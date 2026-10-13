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
	/** Door / buzzer / gate code for whoever comes to the address. */
	accessCode?: string | null;
}

export interface ITaxRegistration {
	country: string;
	type: string;
	/** '' when only the rate is known (the number has not arrived yet). */
	number: string;
	region?: string | null;
	label?: string | null;
	/** The percent charged for this tax (5, 9.975, 13); null when not set. */
	rate?: number | null;
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
	/** The sector / trade, as the app's own key ('plumbing'). */
	industry?: string | null;
	address: IWorkspaceAddress | null;
	legalName: string | null;
	email: string | null;
	website: string | null;
	logoUrl: string | null;
	taxRegistrations: ITaxRegistration[] | null;
	languages: string[] | null;
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
	/** Paused from deleting by the velocity brake, until the owner releases them. */
	paused?: boolean;
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
	/** What goes before a document's number, per kind: { invoice: 'ACME' }. */
	documentPrefixes?: Record<string, string>;
}

// ── Branches (migration 011) ─────────────────────────────────────────────────
// One customer-facing identity of the business; it owns its emails, phones and
// locations. The default branch's identity and primary contacts are mirrored
// onto the workspace's own columns.

export interface IWorkspaceBranch {
	id: string;
	workspaceId: string;
	name: string;
	/** The host a funnel runs on ('quebecmover.com'), lower-cased; null when none. */
	domain: string | null;
	motto: string | null;
	industry: string | null;
	website: string | null;
	logoUrl: string | null;
	/** BCP 47; null = the workspace's own language. */
	locale: string | null;
	taxRegistrations: ITaxRegistration[] | null;
	isDefault: boolean;
	position: number;
	archivedAt: string | null;
	archivedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

// ── Contacts & locations (migration 010, per branch since 011) ───────────────
// The default branch's primary email, primary phone and head office's address
// are mirrored onto fonderie_workspaces.email / phone / address.

export interface IWorkspaceEmail {
	id: string;
	workspaceId: string;
	branchId: string;
	/** Lower-cased. */
	email: string;
	label: string | null;
	isPrimary: boolean;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspacePhone {
	id: string;
	workspaceId: string;
	branchId: string;
	/** E.164, e.g. '+15145550100'. */
	phone: string;
	/** Digits only, e.g. '204'. */
	extension: string | null;
	label: string | null;
	isPrimary: boolean;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspaceLocation {
	id: string;
	workspaceId: string;
	branchId: string;
	name: string;
	address: IWorkspaceAddress;
	/** address.country, as stored (a generated column). */
	country: string | null;
	/** ISO 3166-2, e.g. 'CA-QC' — the region whose sales taxes apply here. */
	taxRegion: string | null;
	latitude: number | string | null;
	longitude: number | string | null;
	phone: string | null;
	email: string | null;
	isHeadOffice: boolean;
	position: number;
	archivedAt: string | null;
	archivedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspaceContacts {
	emails: IWorkspaceEmail[];
	phones: IWorkspacePhone[];
	locations: IWorkspaceLocation[];
}
