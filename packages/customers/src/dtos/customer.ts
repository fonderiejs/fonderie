import { arrayOrEmpty, booleanOrFalse, dateOrEmpty, stringOrEmpty } from '@fonderie-js/core';

import type {
	IAddress,
	ICustomer,
	ICustomerAddress,
	ICustomerDetail,
	ICustomerEmail,
	ICustomerNote,
	ICustomerPhone,
	ICustomerTag,
} from '../types';

export interface ICustomerDTO {
	id: string;
	workspaceId: string;
	type: string;
	firstName: string;
	lastName: string;
	companyName: string;
	jobTitle: string;
	avatarUrl: string;
	locale: string;
	referenceCode: string;
	isArchived: boolean;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface ICustomerDetailDTO extends ICustomerDTO {
	emails: ICustomerEmailDTO[];
	phones: ICustomerPhoneDTO[];
	tags: string[];
}

export interface ICustomerEmailDTO {
	id: string;
	customerId: string;
	email: string;
	label: string;
	isPrimary: boolean;
	createdAt: string;
}

export interface ICustomerPhoneDTO {
	id: string;
	customerId: string;
	phone: string;
	label: string;
	isPrimary: boolean;
	createdAt: string;
}

export interface IAddressDTO {
	id: string;
	countryIso: string;
	subdivision1Iso: string;
	subdivision2Iso: string;
	zipPostalCode: string;
	line1: string;
	line2: string;
}

export interface ICustomerAddressDTO {
	addrId: string;
	customerId: string;
	label: string;
	isPrimary: boolean;
	address: IAddressDTO;
}

export interface ICustomerNoteDTO {
	id: string;
	customerId: string;
	authorId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface ICustomerTagDTO {
	customerId: string;
	tag: string;
}

export function toCustomerDTO(c: ICustomer): ICustomerDTO {
	return {
		id: stringOrEmpty(c.id),
		workspaceId: stringOrEmpty(c.workspaceId),
		type: stringOrEmpty(c.type),
		firstName: stringOrEmpty(c.firstName),
		lastName: stringOrEmpty(c.lastName),
		companyName: stringOrEmpty(c.companyName),
		jobTitle: stringOrEmpty(c.jobTitle),
		avatarUrl: stringOrEmpty(c.avatarUrl),
		locale: stringOrEmpty(c.locale),
		referenceCode: stringOrEmpty(c.referenceCode),
		isArchived: booleanOrFalse(c.isArchived),
		createdBy: stringOrEmpty(c.createdBy),
		createdAt: dateOrEmpty(c.createdAt),
		updatedAt: dateOrEmpty(c.updatedAt),
	};
}

export function toCustomerDetailDTO(c: ICustomerDetail): ICustomerDetailDTO {
	return {
		...toCustomerDTO(c),
		emails: arrayOrEmpty<ICustomerEmail>(c.emails).map(toCustomerEmailDTO),
		phones: arrayOrEmpty<ICustomerPhone>(c.phones).map(toCustomerPhoneDTO),
		tags: arrayOrEmpty<string>(c.tags),
	};
}

export function toAddressDTO(a: IAddress): IAddressDTO {
	return {
		id: stringOrEmpty(a.id),
		countryIso: stringOrEmpty(a.countryIso),
		subdivision1Iso: stringOrEmpty(a.subdivision1Iso),
		subdivision2Iso: stringOrEmpty(a.subdivision2Iso),
		zipPostalCode: stringOrEmpty(a.zipPostalCode),
		line1: stringOrEmpty(a.line1),
		line2: stringOrEmpty(a.line2),
	};
}

export function toCustomerEmailDTO(e: ICustomerEmail): ICustomerEmailDTO {
	return {
		id: stringOrEmpty(e.id),
		customerId: stringOrEmpty(e.customerId),
		email: stringOrEmpty(e.email),
		label: stringOrEmpty(e.label),
		isPrimary: booleanOrFalse(e.isPrimary),
		createdAt: dateOrEmpty(e.createdAt),
	};
}

export function toCustomerPhoneDTO(p: ICustomerPhone): ICustomerPhoneDTO {
	return {
		id: stringOrEmpty(p.id),
		customerId: stringOrEmpty(p.customerId),
		phone: stringOrEmpty(p.phone),
		label: stringOrEmpty(p.label),
		isPrimary: booleanOrFalse(p.isPrimary),
		createdAt: dateOrEmpty(p.createdAt),
	};
}

export function toCustomerAddressDTO(ca: ICustomerAddress): ICustomerAddressDTO {
	return {
		addrId: stringOrEmpty(ca.addrId),
		customerId: stringOrEmpty(ca.customerId),
		label: stringOrEmpty(ca.label),
		isPrimary: booleanOrFalse(ca.isPrimary),
		address: toAddressDTO(ca.address),
	};
}

export function toCustomerNoteDTO(n: ICustomerNote): ICustomerNoteDTO {
	return {
		id: stringOrEmpty(n.id),
		customerId: stringOrEmpty(n.customerId),
		authorId: stringOrEmpty(n.authorId),
		body: stringOrEmpty(n.body),
		createdAt: dateOrEmpty(n.createdAt),
		updatedAt: dateOrEmpty(n.updatedAt),
	};
}

export function toCustomerTagDTO(t: ICustomerTag): ICustomerTagDTO {
	return {
		customerId: stringOrEmpty(t.customerId),
		tag: stringOrEmpty(t.tag),
	};
}
