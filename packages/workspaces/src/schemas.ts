import { z } from 'zod';

import { canonicalLocale } from '@fonderie/core';
import { regions } from '@fonderie/core/region';

// Request schemas — the validation contract for every body-taking workspaces
// route. Wired into routes.ts via @fonderie/core's validate(); exported so
// docs generators and typed clients read the source of truth the runtime
// enforces. Same pattern as @fonderie/auth/src/schemas.ts.

const name = z.string().trim().min(1, 'name is required').max(200);
const email = z.string().trim().pipe(z.email());

function isTimeZone(v: string): boolean {
	try {
		new Intl.DateTimeFormat('en', { timeZone: v });
		return true;
	} catch {
		return false;
	}
}

const CURRENCIES = new Set(
	(Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('currency') ?? ['CAD', 'USD', 'EUR', 'MXN'],
);
const isCurrency = (v: string) => CURRENCIES.has(v);

export const createWorkspaceSchema = z.object({
	name,
	description: z.string().max(2000).optional(),
	// PERSONAL workspaces are created automatically by the module; the
	// controller enforces the rule — schema just types the field.
	type: z.string().max(40).optional(),
});

// Field names match the persisted/read shape (toWorkspaceDTO emits
// state/zip) — the old region/postalCode names validated fields nothing
// wrote while the real ones rode through .passthrough() unvalidated.
// Checked and normalized by the address's country rules (@fonderie/core/region:
// 'Canada' → 'CA', 'Québec' → 'QC', 'h2x1y4' → 'H2X 1Y4'). A country without a
// registered pack is stored as given.
const addressSchema = z
	.object({
		line1: z.string().max(200).optional(),
		line2: z.string().max(200).optional(),
		city: z.string().max(100).optional(),
		state: z.string().max(100).optional(),
		zip: z.string().max(20).optional(),
		country: z.string().max(60).optional(),
	})
	.transform((a, ctx) => {
		const r = regions.checkAddress({ country: a.country ?? null, subdivision: a.state ?? null, postalCode: a.zip ?? null });
		for (const p of r.problems) {
			ctx.addIssue({ code: 'custom', path: [p.field === 'subdivision' ? 'state' : p.field === 'postalCode' ? 'zip' : 'country'], message: p.message });
		}
		return {
			...a,
			...(r.country ? { country: r.country } : {}),
			...(r.subdivision ? { state: r.subdivision } : {}),
			...(r.postalCode ? { zip: r.postalCode } : {}),
		};
	});

export const BUSINESS_TYPES = ['SOLE_PROP', 'PARTNERSHIP', 'LLC', 'INC', 'NONPROFIT', 'COOPERATIVE'] as const;

// A BCP 47 tag, stored canonical ('fr-ca' → 'fr-CA', 'zh-hant-hk' → 'zh-Hant-HK').
const localeTag = z
	.string()
	.max(35)
	.transform((v, ctx) => {
		const c = canonicalLocale(v);
		if (!c) ctx.addIssue({ code: 'custom', message: `'${v}' is not a language tag (e.g. en-CA, fr-CA, es-US, zh-Hans)` });
		return c ?? v;
	});

// A registration is checked against its COUNTRY's rules (which types exist,
// their format, whether a region is required) — no country is built in here.
const taxRegistration = z
	.object({
		country: z.string().trim().min(2).max(60),
		type: z.string().trim().min(1).max(40),
		number: z.string().trim().min(1).max(40),
		region: z.string().max(10).nullable().optional(),
		label: z.string().max(40).nullable().optional(),
	})
	.transform((r, ctx) => {
		const checked = regions.checkTaxRegistration({ country: r.country, type: r.type, number: r.number, region: r.region ?? null, label: r.label ?? null });
		if ('problem' in checked) {
			ctx.addIssue({ code: 'custom', path: ['number'], message: checked.problem });
			return { ...r, region: r.region ?? null, label: r.label ?? null };
		}
		return checked.value;
	});

export const updateWorkspaceSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		description: z.string().max(2000).nullable().optional(),
		motto: z.string().max(300).nullable().optional(),
		phone: z.string().max(32).nullable().optional(),
		businessType: z.enum(BUSINESS_TYPES).nullable().optional(),
		address: addressSchema.nullable().optional(),
		legalName: z.string().trim().max(200).nullable().optional(),
		email: email.nullable().optional(),
		website: z.string().trim().pipe(z.url({ protocol: /^https?$/ })).nullable().optional(),
		// The logo's URL — typically what @fonderie/media returned for the upload.
		logoUrl: z.string().trim().pipe(z.url({ protocol: /^https?$/ })).nullable().optional(),
		taxRegistrations: z.array(taxRegistration).max(20).optional(),
		// The languages the business serves customers in — what a customer's
		// preferred-language picker offers. Deduplicated, in the order given.
		languages: z
			.array(localeTag)
			.max(12)
			.transform((l) => [...new Set(l)])
			.optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const updateSettingsSchema = z
	.object({
		locale: localeTag.optional(),
		timezone: z
			.string()
			.max(64)
			.refine((v) => isTimeZone(v), "Not an IANA time zone (e.g. 'America/Toronto')")
			.optional(),
		currency: z
			.string()
			.length(3)
			.transform((v) => v.toUpperCase())
			.refine((v) => isCurrency(v), 'Not an ISO 4217 currency (e.g. CAD, USD)')
			.optional(),
		dateFormat: z.string().max(32).optional(),
		timeFormat: z.string().max(32).optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'No settings provided');

export const transferOwnershipSchema = z.object({ userId: z.string().min(1, 'userId is required') });

export const addMemberRoleSchema = z.object({ roleId: z.string().min(1, 'roleId is required') });

const inviteEntry = z.object({
	email,
	roleId: z.string().min(1).optional(),
});

// POST /workspaces/invitations accepts a single invite or a batch.
export const createInvitationsSchema = z.union([
	inviteEntry,
	z.array(inviteEntry).min(1, 'at least one invite is required'),
]);

// Accept by 6-digit PIN (typed from the email; bound to the invited email at
// lookup) or by the high-entropy token (from the email's link; usable by
// accounts without an email address, e.g. phone-registered users).
export const acceptInvitationSchema = z.union([
	z.object({ pin: z.string().trim().min(1, 'pin is required') }),
	z.object({ token: z.string().trim().min(1, 'token is required') }),
]);

export const createRoleSchema = z.object({
	name,
	description: z.string().max(1000).optional(),
});

export const updateRoleSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		description: z.string().max(1000).nullable().optional(),
		active: z.boolean().optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const setRolePermissionsSchema = z.object({
	permissions: z.array(
		z.object({
			permissionKey: z.string().min(1),
			canCreate: z.boolean().optional(),
			canRead: z.boolean().optional(),
			canUpdate: z.boolean().optional(),
			canDelete: z.boolean().optional(),
		}),
	),
});
