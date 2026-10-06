import { booleanOrFalse, dateOrEmpty, stringOrEmpty } from '@fonderie/core/parser';

import type {
	IWorkspace,
	IRole,
	IMember,
	IInvitation,
	IWorkspaceSettings,
	IWorkspaceAddress,
	IWorkspaceContacts,
	IWorkspaceEmail,
	IWorkspaceLocation,
	IWorkspacePhone,
} from '../types';

export interface IWorkspaceAddressDTO {
	line1: string;
	line2: string;
	city: string;
	state: string;
	zip: string;
	country: string;
	/** Door / buzzer / gate code; '' when not set. The unit is line2. */
	accessCode: string;
}

export interface ITaxRegistrationDTO {
	/** ISO 3166-1, e.g. 'CA'. */
	country: string;
	/** A key of that country's tax-ID rules, e.g. 'GST_HST', 'EIN'. */
	type: string;
	/** '' when only the rate is known. */
	number: string;
	/** ISO 3166-2, e.g. 'CA-QC'; '' when not regional. */
	region: string;
	label: string;
	/** The percent charged for this tax (5, 9.975, 13); null when not set. */
	rate: number | null;
}

export interface IWorkspaceDTO {
	id: string;
	name: string;
	slug: string;
	type: string;
	description: string;
	motto: string;
	phone: string;
	businessType: string;
	/** The sector / trade, as the app's own key ('plumbing'); '' when not set. */
	industry: string;
	address: IWorkspaceAddressDTO;
	/** Registered name, when it differs from the display name. */
	legalName: string;
	email: string;
	website: string;
	logoUrl: string;
	/** GST/HST, QST, PST, EIN, state sales-tax permits… — normalized. */
	taxRegistrations: ITaxRegistrationDTO[];
	/** The languages the business serves customers in (BCP 47), e.g. ['en-CA', 'fr-CA']. */
	languages: string[];
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
	isArchived: boolean;
	archivedAt: string;
	// User id that archived the workspace; '' while unarchived.
	archivedBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface IRoleDTO {
	id: string;
	name: string;
	isSystem: boolean;
	active: boolean;
	description: string;
	workspaceId: string;
}

export interface IMemberDTO {
	userId: string;
	workspaceId: string;
	roleId: string;
	roleName: string;
	confirmed: boolean;
	createdAt: string;
	/**
	 * Identity, carried so a member list is renderable from this endpoint alone.
	 *
	 * listMembers() already joins the users table for these; without them a
	 * client has no name to show and falls back to printing a user id.
	 *
	 * Empty string when absent, matching every other string field in this file.
	 */
	email: string;
	firstName: string;
	lastName: string;
	profileImageUrl: string;
	/** Every role this person holds here, earliest first. */
	roles: IMemberRoleDTO[];
	/** The workspace owner. */
	isOwner: boolean;
	/** The owner, or a holder of a manager role — may manage the team. */
	isManager: boolean;
	/** Paused from deleting by the velocity brake (Phase 5), until the owner releases them. */
	paused: boolean;
}

export interface IMemberRoleDTO {
	id: string;
	name: string;
	isSystem: boolean;
}

export interface IInvitationDTO {
	id: string;
	workspaceId: string;
	email: string;
	roleId: string;
	token: string;
	status: string;
	expiresAt: string;
	createdAt: string;
	/** Past its expiry: still listed so a manager can resend it, but no longer acceptable. */
	isExpired: boolean;
}

export interface IWorkspaceSettingsDTO {
	locale: string;
	timezone: string;
	currency: string;
	dateFormat: string;
	timeFormat: string;
	/** What goes before a document's number, per kind: { invoice: 'ACME', job: 'ACME-JOB' }; {} when none. */
	documentPrefixes: Record<string, string>;
}

export interface IWorkspaceEmailDTO {
	id: string;
	/** Lower-cased. */
	email: string;
	label: string;
	isPrimary: boolean;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspacePhoneDTO {
	id: string;
	/** E.164, e.g. '+15145550100'. */
	phone: string;
	/** Digits; '' when none. */
	extension: string;
	label: string;
	isPrimary: boolean;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspaceLocationDTO {
	id: string;
	name: string;
	address: IWorkspaceAddressDTO;
	/** ISO 3166-2, e.g. 'CA-QC' — whose sales taxes apply here; '' when unknown. */
	taxRegion: string;
	latitude: number | null;
	longitude: number | null;
	/** E.164; '' when none. */
	phone: string;
	email: string;
	isHeadOffice: boolean;
	position: number;
	isArchived: boolean;
	archivedAt: string;
	archivedBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspaceContactsDTO {
	/** The primary first. */
	emails: IWorkspaceEmailDTO[];
	/** The primary first. */
	phones: IWorkspacePhoneDTO[];
	/** The head office first; archived ones last (restorable). */
	locations: IWorkspaceLocationDTO[];
}

function toAddressDTO(a: IWorkspaceAddress | null | undefined): IWorkspaceAddressDTO {
	const addr = a ?? {};
	return {
		line1: stringOrEmpty(addr.line1),
		line2: stringOrEmpty(addr.line2),
		city: stringOrEmpty(addr.city),
		state: stringOrEmpty(addr.state),
		zip: stringOrEmpty(addr.zip),
		country: stringOrEmpty(addr.country),
		accessCode: stringOrEmpty(addr.accessCode),
	};
}

const numberOrNull = (v: unknown): number | null => {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
};

export function toWorkspaceEmailDTO(e: IWorkspaceEmail): IWorkspaceEmailDTO {
	return {
		id: stringOrEmpty(e.id),
		email: stringOrEmpty(e.email),
		label: stringOrEmpty(e.label),
		isPrimary: booleanOrFalse(e.isPrimary),
		position: Number(e.position ?? 0),
		createdAt: dateOrEmpty(e.createdAt),
		updatedAt: dateOrEmpty(e.updatedAt),
	};
}

export function toWorkspacePhoneDTO(p: IWorkspacePhone): IWorkspacePhoneDTO {
	return {
		id: stringOrEmpty(p.id),
		phone: stringOrEmpty(p.phone),
		extension: stringOrEmpty(p.extension),
		label: stringOrEmpty(p.label),
		isPrimary: booleanOrFalse(p.isPrimary),
		position: Number(p.position ?? 0),
		createdAt: dateOrEmpty(p.createdAt),
		updatedAt: dateOrEmpty(p.updatedAt),
	};
}

export function toWorkspaceLocationDTO(l: IWorkspaceLocation): IWorkspaceLocationDTO {
	return {
		id: stringOrEmpty(l.id),
		name: stringOrEmpty(l.name),
		address: toAddressDTO(l.address),
		taxRegion: stringOrEmpty(l.taxRegion),
		latitude: numberOrNull(l.latitude),
		longitude: numberOrNull(l.longitude),
		phone: stringOrEmpty(l.phone),
		email: stringOrEmpty(l.email),
		isHeadOffice: booleanOrFalse(l.isHeadOffice),
		position: Number(l.position ?? 0),
		isArchived: l.archivedAt !== null && l.archivedAt !== undefined,
		archivedAt: dateOrEmpty(l.archivedAt),
		archivedBy: stringOrEmpty(l.archivedBy),
		createdAt: dateOrEmpty(l.createdAt),
		updatedAt: dateOrEmpty(l.updatedAt),
	};
}

export function toWorkspaceContactsDTO(c: IWorkspaceContacts): IWorkspaceContactsDTO {
	return {
		emails: c.emails.map(toWorkspaceEmailDTO),
		phones: c.phones.map(toWorkspacePhoneDTO),
		locations: c.locations.map(toWorkspaceLocationDTO),
	};
}

export function toWorkspaceDTO(ws: IWorkspace): IWorkspaceDTO {
	const addr = ws.address ?? {};
	return {
		id: stringOrEmpty(ws.id),
		name: stringOrEmpty(ws.name),
		slug: stringOrEmpty(ws.slug),
		type: stringOrEmpty(ws.type),
		description: stringOrEmpty(ws.description),
		motto: stringOrEmpty(ws.motto),
		phone: stringOrEmpty(ws.phone),
		businessType: stringOrEmpty(ws.businessType),
		industry: stringOrEmpty(ws.industry),
		address: {
			line1: stringOrEmpty(addr.line1),
			line2: stringOrEmpty(addr.line2),
			city: stringOrEmpty(addr.city),
			state: stringOrEmpty(addr.state),
			zip: stringOrEmpty(addr.zip),
			country: stringOrEmpty(addr.country),
			accessCode: stringOrEmpty(addr.accessCode),
		},
		legalName: stringOrEmpty(ws.legalName),
		email: stringOrEmpty(ws.email),
		website: stringOrEmpty(ws.website),
		logoUrl: stringOrEmpty(ws.logoUrl),
		taxRegistrations: (Array.isArray(ws.taxRegistrations) ? ws.taxRegistrations : []).map((r) => ({
			country: stringOrEmpty(r.country),
			type: stringOrEmpty(r.type),
			number: stringOrEmpty(r.number),
			region: stringOrEmpty(r.region),
			label: stringOrEmpty(r.label),
			rate: typeof r.rate === 'number' && Number.isFinite(r.rate) ? r.rate : null,
		})),
		languages: Array.isArray(ws.languages) ? ws.languages.map(String) : [],
		plan: stringOrEmpty(ws.plan),
		ownerId: stringOrEmpty(ws.ownerId),
		isPersonal: booleanOrFalse(ws.isPersonal),
		isArchived: ws.archivedAt !== null,
		archivedAt: dateOrEmpty(ws.archivedAt),
		archivedBy: stringOrEmpty(ws.archivedBy),
		createdAt: dateOrEmpty(ws.createdAt),
		updatedAt: dateOrEmpty(ws.updatedAt),
	};
}

export function toRoleDTO(role: IRole): IRoleDTO {
	return {
		id: stringOrEmpty(role.id),
		name: stringOrEmpty(role.name),
		isSystem: booleanOrFalse(role.isSystem),
		active: role.active !== false,
		description: stringOrEmpty(role.description),
		workspaceId: stringOrEmpty(role.workspaceId),
	};
}

export function toMemberDTO(m: IMember): IMemberDTO {
	return {
		userId: stringOrEmpty(m.userId),
		workspaceId: stringOrEmpty(m.workspaceId),
		roleId: stringOrEmpty(m.roleId),
		roleName: stringOrEmpty(m.roleName),
		confirmed: booleanOrFalse(m.confirmed),
		createdAt: dateOrEmpty(m.createdAt),
		email: stringOrEmpty(m.email),
		firstName: stringOrEmpty(m.firstName),
		lastName: stringOrEmpty(m.lastName),
		profileImageUrl: stringOrEmpty(m.profileImageUrl),
		roles: Array.isArray(m.roles)
			? m.roles.map((r) => ({ id: stringOrEmpty(r.id), name: stringOrEmpty(r.name), isSystem: booleanOrFalse(r.isSystem) }))
			: m.roleId ? [{ id: stringOrEmpty(m.roleId), name: stringOrEmpty(m.roleName), isSystem: false }] : [],
		isOwner: booleanOrFalse(m.isOwner),
		isManager: booleanOrFalse(m.isManager),
		paused: booleanOrFalse(m.paused),
	};
}

export function toInvitationDTO(inv: IInvitation): IInvitationDTO {
	return {
		id: stringOrEmpty(inv.id),
		workspaceId: stringOrEmpty(inv.workspaceId),
		email: stringOrEmpty(inv.email),
		roleId: stringOrEmpty(inv.roleId),
		// The accept token is a bearer credential delivered to the INVITEE by
		// email — never expose it through the API. Listing invitations used to
		// leak it, letting any member accept (hijack) someone else's pending
		// invite. The field stays for DTO-shape compatibility, always empty.
		token: '',
		status: stringOrEmpty(inv.status),
		expiresAt: dateOrEmpty(inv.expiresAt),
		createdAt: dateOrEmpty(inv.createdAt),
		isExpired: !!inv.expiresAt && new Date(inv.expiresAt).getTime() <= Date.now(),
	};
}

export function toSettingsDTO(s: IWorkspaceSettings): IWorkspaceSettingsDTO {
	return {
		locale: stringOrEmpty(s.locale),
		timezone: stringOrEmpty(s.timezone),
		currency: stringOrEmpty(s.currency),
		dateFormat: stringOrEmpty(s.dateFormat),
		timeFormat: stringOrEmpty(s.timeFormat),
		documentPrefixes: { ...(s.documentPrefixes ?? {}) },
	};
}
