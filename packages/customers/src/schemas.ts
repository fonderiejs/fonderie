import { z } from 'zod';

// Request schemas — the validation contract for every body-taking customers
// route. Wired via @fonderie/core's validate(); same pattern as
// @fonderie/auth. Exported for docs generation and typed clients.

const label = z.string().max(100).optional();
const isPrimary = z.boolean().optional();
const email = z.string().trim().pipe(z.email());
const phone = z
	.string()
	.refine((v) => /^\+?[1-9]\d{6,14}$/.test(v.replace(/[\s\-()]/g, '')), 'Invalid phone number');

const customerFields = {
	type: z.enum(['individual', 'business']).optional(),
	sex: z.enum(['UNKNOWN', 'MALE', 'FEMALE']).optional(),
	firstName: z.string().max(100).nullable().optional(),
	lastName: z.string().max(100).nullable().optional(),
	companyName: z.string().max(200).nullable().optional(),
	avatarUrl: z.string().trim().pipe(z.url()).nullable().optional(),
	locale: z.string().max(35).nullable().optional(),
	referenceCode: z.string().max(100).nullable().optional(),
	referralCode: z.string().max(100).nullable().optional(),
	referredByCode: z.string().max(100).nullable().optional(),
};

export const createCustomerSchema = z.object(customerFields);

export const updateCustomerSchema = z
	.object(customerFields)
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const blacklistSchema = z.object({ reason: z.string().max(1000).optional() });

export const addEmailSchema = z.object({ email, label, isPrimary });
export const updateEmailSchema = z
	.object({ email: email.optional(), label, isPrimary })
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const addPhoneSchema = z.object({ phone, label, isPrimary });
export const updatePhoneSchema = z
	.object({ phone: phone.optional(), label, isPrimary })
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

const addressFields = {
	label,
	isPrimary,
	line1: z.string().max(200).nullable().optional(),
	line2: z.string().max(200).nullable().optional(),
	unit: z.string().max(50).nullable().optional(),
	zipPostalCode: z.string().max(20).nullable().optional(),
	countryIso: z.string().max(3).nullable().optional(),
	subdivision1Iso: z.string().max(10).nullable().optional(),
	subdivision2Iso: z.string().max(10).nullable().optional(),
};
export const addAddressSchema = z.object(addressFields);
export const updateAddressSchema = z
	.object(addressFields)
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const noteSchema = z.object({ body: z.string().trim().min(1, 'body is required').max(10000) });

export const addTagSchema = z.object({ tag: z.string().trim().min(1, 'tag is required').max(100) });

export const addRelationshipSchema = z.object({
	relatedId: z.string().min(1, 'relatedId is required'),
	relationship: z.string().max(100).optional(),
	isPrimary,
});
