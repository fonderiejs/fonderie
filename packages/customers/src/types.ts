export type CustomerType = 'individual' | 'business';
export type CustomerSex = 'UNKNOWN' | 'MALE' | 'FEMALE';
export type EmailLabel = 'work' | 'personal' | 'billing';
export type PhoneLabel = 'mobile' | 'office' | 'home' | 'fax';
export type AddressLabel = 'service' | 'billing' | 'other';

export interface ICustomer {
	id: string;
	workspaceId: string;
	type: CustomerType;
	sex: CustomerSex;
	firstName: string | null;
	lastName: string | null;
	companyName: string | null;
	avatarUrl: string | null;
	locale: string;
	referenceCode: string | null;
	isBlacklisted: boolean;
	blacklistReason: string | null;
	createdBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ICustomerEmail {
	id: string;
	customerId: string;
	email: string;
	label: EmailLabel;
	isPrimary: boolean;
	createdAt: string;
}

export interface ICustomerPhone {
	id: string;
	customerId: string;
	phone: string;
	label: PhoneLabel;
	isPrimary: boolean;
	createdAt: string;
}

export interface IAddress {
	id: string;
	countryIso: string;
	subdivision1Iso: string | null;
	subdivision2Iso: string | null;
	zipPostalCode: string;
	unit: string | null;
	line1: string | null;
	line2: string | null;
}

export interface ICustomerAddress {
	addrId: string;
	customerId: string;
	label: AddressLabel;
	isPrimary: boolean;
	address: IAddress;
}

export interface ICustomerNote {
	id: string;
	customerId: string;
	authorId: string | null;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface ICustomerTag {
	customerId: string;
	tag: string;
}

export interface ICustomerRelationship {
	id: string;
	workspaceId: string;
	customerId: string;
	relatedId: string;
	relationship: string;
	isPrimary: boolean;
	createdAt: string;
}

export interface ICustomerShallow extends ICustomer {
	emails: ICustomerEmail[];
	phones: ICustomerPhone[];
	notes: ICustomerNote[];
	tags: string[];
}

export interface ICustomerRelationshipExpanded {
	id: string;
	workspaceId: string;
	customerId: string;
	relationship: string;
	isPrimary: boolean;
	createdAt: string;
	customer: ICustomerShallow;
}

export interface ICustomerDetail extends ICustomer {
	emails: ICustomerEmail[];
	phones: ICustomerPhone[];
	addresses: ICustomerAddress[];
	notes: ICustomerNote[];
	relationships: ICustomerRelationshipExpanded[];
	tags: string[];
}
