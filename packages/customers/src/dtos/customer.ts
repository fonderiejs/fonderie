import { arrayOrEmpty, booleanOrFalse, dateOrEmpty, stringOrEmpty } from '@fonderie/core';

import type { CustomerLabelType, CustomerSex } from '../types';
import type {
	IAddress,
	ICustomer,
	ICustomerAddress,
	ICustomerDetail,
	ICustomerDetailD2,
	ICustomerEmail,
	ICustomerNote,
	ICustomerPhone,
	ICustomerRelationship,
	ICustomerRelationshipExpanded,
	ICustomerRelationshipExpandedD2,
	ICustomerShallow,
	ICustomerLabel,
} from '../types';

export interface ICustomerDTO {
	id: string;
	type: string;
	sex: CustomerSex;
	firstName: string;
	lastName: string;
	companyName: string;
	avatarUrl: string;
	/** Preferred language (BCP 47), e.g. 'fr-CA', 'zh-Hant'. */
	locale: string;
	/**
	 * The customer's time zone (IANA), e.g. 'America/Toronto' — what times on
	 * documents sent to them are printed in. null: none set; use the business's.
	 */
	timezone: string | null;
	/**
	 * The name to show, in the order the customer's language writes it:
	 * family name first, no space, for Chinese, Japanese and Korean ('王小明');
	 * given name first otherwise ('Marie Tremblay'). A business shows its
	 * company name.
	 */
	displayName: string;
	referenceCode: string;
	referralCode: string;
	referredBy: string | null;
	blacklisted: { status: boolean; reason: string | null };
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	/** Archived: hidden from lists and pickers, kept on documents. */
	archived: { status: boolean; at: string | null };
}

export interface ICustomerRelationshipDTO {
	id: string;
	relatedId: string;
	relationship: string;
	isPrimary: boolean;
	createdAt: string;
}

export interface ICustomerShallowDTO extends ICustomerDTO {
	emails: ICustomerEmailDTO[];
	phones: ICustomerPhoneDTO[];
	addresses: ICustomerAddressDTO[];
	notes: ICustomerNoteDTO[];
	tags: string[];
}

// Flat merge: relationship metadata + customer fields spread at the same level.
// `id` is the relationship record id; `customerId` is the related customer's
// id. NOTE: the spread customer fields include the related CUSTOMER's
// createdAt/updatedAt — `relationshipCreatedAt` is when the relationship
// itself was created (what ICustomerRelationshipDTO.createdAt means).
export type ICustomerRelationshipExpandedDTO = Omit<ICustomerShallowDTO, 'id'> & {
	/** The RELATED customer's id — same name as in ICustomerRelationshipDTO. */
	relatedId: string;
	/** The relationship record's id. */
	relationshipId: string;
	/** @deprecated The relationship record's id, not a customer's — read `relationshipId`. */
	id: string;
	/** @deprecated The related customer's id — read `relatedId`. */
	customerId: string;
	relationship: string;
	isPrimary: boolean;
	relationshipCreatedAt: string;
};

export interface ICustomerDetailDTO extends ICustomerDTO {
	emails: ICustomerEmailDTO[];
	phones: ICustomerPhoneDTO[];
	addresses: ICustomerAddressDTO[];
	notes: ICustomerNoteDTO[];
	relationships: ICustomerRelationshipExpandedDTO[];
	tags: string[];
}

// Depth-2 DTOs: each depth-1 relationship entry carries its own relationships array.
export type ICustomerRelationshipExpandedD2DTO = ICustomerRelationshipExpandedDTO & {
	relationships: ICustomerRelationshipExpandedDTO[];
};

export interface ICustomerDetailD2DTO extends Omit<ICustomerDetailDTO, 'relationships'> {
	relationships: ICustomerRelationshipExpandedD2DTO[];
}

export interface ICustomerEmailDTO {
	id: string;
	email: string;
	label: string;
	// Id of the shared label row (see /customers/labels) — null when unlabeled.
	labelId: string | null;
	isPrimary: boolean;
	createdAt: string;
}

export interface ICustomerPhoneDTO {
	id: string;
	phone: string;
	label: string;
	// Id of the shared label row (see /customers/labels) — null when unlabeled.
	labelId: string | null;
	isPrimary: boolean;
	createdAt: string;
}

export interface IAddressDTO {
	countryIso: string;
	subdivision1Iso: string;
	subdivision2Iso: string;
	zipPostalCode: string;
	unit: string;
	line1: string;
	line2: string;
}

export interface ICustomerAddressDTO {
	id: string;
	label: string;
	// Id of the shared label row (see /customers/labels) — null when unlabeled.
	labelId: string | null;
	isPrimary: boolean;
	address: IAddressDTO;
}

export interface ICustomerNoteDTO {
	id: string;
	authorId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
}

// Serialized shared label (GET /customers/labels) — the one customers
// response that previously bypassed DTO mapping and leaked raw Date rows.
export interface ICustomerLabelDTO {
	id: string;
	type: CustomerLabelType;
	value: string;
	createdAt: string;
}

const VALID_SEX: CustomerSex[] = ['UNKNOWN', 'MALE', 'FEMALE'];

const FAMILY_NAME_FIRST = new Set(['zh', 'ja', 'ko']);

export function displayNameOf(c: Pick<ICustomer, 'type' | 'firstName' | 'lastName' | 'companyName' | 'locale' | 'referenceCode'>): string {
	const first = c.firstName?.trim() ?? '';
	const last = c.lastName?.trim() ?? '';
	const company = c.companyName?.trim() ?? '';
	if (c.type === 'business' && company) return company;
	const lang = (c.locale ?? '').split('-')[0]!.toLowerCase();
	const person = FAMILY_NAME_FIRST.has(lang) ? `${last}${first}` : [first, last].filter(Boolean).join(' ');
	return person || company || (c.referenceCode ?? '');
}

export function toCustomerDTO(c: ICustomer): ICustomerDTO {
	return {
		id: stringOrEmpty(c.id),
		type: stringOrEmpty(c.type),
		sex: VALID_SEX.includes(c.sex as CustomerSex) ? (c.sex as CustomerSex) : 'UNKNOWN',
		firstName: stringOrEmpty(c.firstName),
		lastName: stringOrEmpty(c.lastName),
		companyName: stringOrEmpty(c.companyName),
		avatarUrl: stringOrEmpty(c.avatarUrl),
		locale: stringOrEmpty(c.locale),
		timezone: c.timezone ?? null,
		displayName: displayNameOf(c),
		referenceCode: stringOrEmpty(c.referenceCode),
		referralCode: stringOrEmpty(c.referralCode),
		referredBy: c.referredBy ?? null,
		blacklisted: { status: booleanOrFalse(c.isBlacklisted), reason: c.blacklistReason ?? null },
		archived: { status: booleanOrFalse(c.isArchived), at: c.archivedAt ? dateOrEmpty(c.archivedAt) : null },
		createdBy: stringOrEmpty(c.createdBy),
		createdAt: dateOrEmpty(c.createdAt),
		updatedAt: dateOrEmpty(c.updatedAt),
	};
}

export function toCustomerRelationshipDTO(r: ICustomerRelationship): ICustomerRelationshipDTO {
	return {
		id: stringOrEmpty(r.id),
		relatedId: stringOrEmpty(r.relatedId),
		relationship: stringOrEmpty(r.relationship),
		isPrimary: booleanOrFalse(r.isPrimary),
		createdAt: dateOrEmpty(r.createdAt),
	};
}

export function toCustomerShallowDTO(c: ICustomerShallow): ICustomerShallowDTO {
	return {
		...toCustomerDTO(c),
		emails: arrayOrEmpty<ICustomerEmail>(c.emails).map(toCustomerEmailDTO),
		phones: arrayOrEmpty<ICustomerPhone>(c.phones).map(toCustomerPhoneDTO),
		addresses: arrayOrEmpty<ICustomerAddress>(c.addresses).map(toCustomerAddressDTO),
		notes: arrayOrEmpty<ICustomerNote>(c.notes).map(toCustomerNoteDTO),
		tags: arrayOrEmpty<string>(c.tags),
	};
}

export function toCustomerRelationshipExpandedDTO(r: ICustomerRelationshipExpanded): ICustomerRelationshipExpandedDTO {
	const { id: customerId, ...customerFields } = toCustomerShallowDTO(r.customer);
	return {
		relatedId: customerId,
		relationshipId: stringOrEmpty(r.id),
		id: stringOrEmpty(r.id),
		customerId,
		relationship: stringOrEmpty(r.relationship),
		isPrimary: booleanOrFalse(r.isPrimary),
		relationshipCreatedAt: dateOrEmpty(r.createdAt),
		...customerFields,
	};
}

export function toCustomerDetailDTO(c: ICustomerDetail): ICustomerDetailDTO {
	return {
		...toCustomerDTO(c),
		emails: arrayOrEmpty<ICustomerEmail>(c.emails).map(toCustomerEmailDTO),
		phones: arrayOrEmpty<ICustomerPhone>(c.phones).map(toCustomerPhoneDTO),
		addresses: arrayOrEmpty<ICustomerAddress>(c.addresses).map(toCustomerAddressDTO),
		notes: arrayOrEmpty<ICustomerNote>(c.notes).map(toCustomerNoteDTO),
		relationships: arrayOrEmpty<ICustomerRelationshipExpanded>(c.relationships).map(toCustomerRelationshipExpandedDTO),
		tags: arrayOrEmpty<string>(c.tags),
	};
}

export function toCustomerRelationshipExpandedD2DTO(r: ICustomerRelationshipExpandedD2): ICustomerRelationshipExpandedD2DTO {
	const { id: customerId, ...customerFields } = toCustomerShallowDTO(r.customer);
	return {
		relatedId: customerId,
		relationshipId: stringOrEmpty(r.id),
		id: stringOrEmpty(r.id),
		customerId,
		relationship: stringOrEmpty(r.relationship),
		isPrimary: booleanOrFalse(r.isPrimary),
		relationshipCreatedAt: dateOrEmpty(r.createdAt),
		...customerFields,
		relationships: arrayOrEmpty<ICustomerRelationshipExpanded>(r.customer.relationships).map(toCustomerRelationshipExpandedDTO),
	};
}

export function toCustomerDetailD2DTO(c: ICustomerDetailD2): ICustomerDetailD2DTO {
	return {
		...toCustomerDTO(c),
		emails: arrayOrEmpty<ICustomerEmail>(c.emails).map(toCustomerEmailDTO),
		phones: arrayOrEmpty<ICustomerPhone>(c.phones).map(toCustomerPhoneDTO),
		addresses: arrayOrEmpty<ICustomerAddress>(c.addresses).map(toCustomerAddressDTO),
		notes: arrayOrEmpty<ICustomerNote>(c.notes).map(toCustomerNoteDTO),
		relationships: arrayOrEmpty<ICustomerRelationshipExpandedD2>(c.relationships).map(toCustomerRelationshipExpandedD2DTO),
		tags: arrayOrEmpty<string>(c.tags),
	};
}

export function toAddressDTO(a: IAddress): IAddressDTO {
	return {
		countryIso: stringOrEmpty(a.countryIso),
		subdivision1Iso: stringOrEmpty(a.subdivision1Iso),
		subdivision2Iso: stringOrEmpty(a.subdivision2Iso),
		zipPostalCode: stringOrEmpty(a.zipPostalCode),
		unit: stringOrEmpty(a.unit),
		line1: stringOrEmpty(a.line1),
		line2: stringOrEmpty(a.line2),
	};
}

export function toCustomerEmailDTO(e: ICustomerEmail): ICustomerEmailDTO {
	return {
		id: stringOrEmpty(e.id),
		email: stringOrEmpty(e.email),
		label: stringOrEmpty(e.label),
		labelId: e.labelId ?? null,
		isPrimary: booleanOrFalse(e.isPrimary),
		createdAt: dateOrEmpty(e.createdAt),
	};
}

export function toCustomerPhoneDTO(p: ICustomerPhone): ICustomerPhoneDTO {
	return {
		id: stringOrEmpty(p.id),
		phone: stringOrEmpty(p.phone),
		label: stringOrEmpty(p.label),
		labelId: p.labelId ?? null,
		isPrimary: booleanOrFalse(p.isPrimary),
		createdAt: dateOrEmpty(p.createdAt),
	};
}

export function toCustomerAddressDTO(ca: ICustomerAddress): ICustomerAddressDTO {
	return {
		id: stringOrEmpty(ca.addrId),
		label: stringOrEmpty(ca.label),
		labelId: ca.labelId ?? null,
		isPrimary: booleanOrFalse(ca.isPrimary),
		address: toAddressDTO(ca.address),
	};
}

export function toCustomerNoteDTO(n: ICustomerNote): ICustomerNoteDTO {
	return {
		id: stringOrEmpty(n.id),
		authorId: stringOrEmpty(n.authorId),
		body: stringOrEmpty(n.body),
		createdAt: dateOrEmpty(n.createdAt),
		updatedAt: dateOrEmpty(n.updatedAt),
	};
}

export function toCustomerLabelDTO(l: ICustomerLabel): ICustomerLabelDTO {
	return {
		id: stringOrEmpty(l.id),
		type: l.type,
		value: stringOrEmpty(l.value),
		createdAt: dateOrEmpty(l.createdAt),
	};
}
