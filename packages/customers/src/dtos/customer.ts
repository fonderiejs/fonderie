import { arrayOrEmpty, booleanOrFalse, dateOrEmpty, stringOrEmpty } from '@fonderie/core';

import type { CustomerSex } from '../types';
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
	ICustomerTag,
} from '../types';

export interface ICustomerDTO {
	id: string;
	type: string;
	sex: CustomerSex;
	firstName: string;
	lastName: string;
	companyName: string;
	avatarUrl: string;
	locale: string;
	referenceCode: string;
	referralCode: string;
	referredBy: string | null;
	blacklisted: { status: boolean; reason: string | null };
	createdBy: string;
	createdAt: string;
	updatedAt: string;
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
// `id` is the relationship record id; `customerId` is the related customer's id.
export type ICustomerRelationshipExpandedDTO = Omit<ICustomerShallowDTO, 'id'> & {
	id: string;
	customerId: string;
	relationship: string;
	isPrimary: boolean;
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
	isPrimary: boolean;
	createdAt: string;
}

export interface ICustomerPhoneDTO {
	id: string;
	phone: string;
	label: string;
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

export interface ICustomerTagDTO {
	tag: string;
}

const VALID_SEX: CustomerSex[] = ['UNKNOWN', 'MALE', 'FEMALE'];

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
		referenceCode: stringOrEmpty(c.referenceCode),
		referralCode: stringOrEmpty(c.referralCode),
		referredBy: c.referredBy ?? null,
		blacklisted: { status: booleanOrFalse(c.isBlacklisted), reason: c.blacklistReason ?? null },
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
		id: stringOrEmpty(r.id),
		customerId,
		relationship: stringOrEmpty(r.relationship),
		isPrimary: booleanOrFalse(r.isPrimary),
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
		id: stringOrEmpty(r.id),
		customerId,
		relationship: stringOrEmpty(r.relationship),
		isPrimary: booleanOrFalse(r.isPrimary),
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
		isPrimary: booleanOrFalse(e.isPrimary),
		createdAt: dateOrEmpty(e.createdAt),
	};
}

export function toCustomerPhoneDTO(p: ICustomerPhone): ICustomerPhoneDTO {
	return {
		id: stringOrEmpty(p.id),
		phone: stringOrEmpty(p.phone),
		label: stringOrEmpty(p.label),
		isPrimary: booleanOrFalse(p.isPrimary),
		createdAt: dateOrEmpty(p.createdAt),
	};
}

export function toCustomerAddressDTO(ca: ICustomerAddress): ICustomerAddressDTO {
	return {
		id: stringOrEmpty(ca.addrId),
		label: stringOrEmpty(ca.label),
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

export function toCustomerTagDTO(t: ICustomerTag): ICustomerTagDTO {
	return {
		tag: stringOrEmpty(t.tag),
	};
}
