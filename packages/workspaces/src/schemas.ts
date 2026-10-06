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
		// A door / buzzer / gate code for whoever comes to the address. The unit
		// (suite, apartment) stays line2.
		accessCode: z.string().trim().max(20).nullable().optional(),
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
//
// `rate` is the percent the business charges for that tax (5, 9.975, 13). A
// business may charge a tax before its number arrives, so a registration needs
// a number, a rate, or both. Without a number, the type and region are still
// checked against the country's rules.
const rate = z
	.number()
	.min(0, 'rate must be 0 or more (a percent, e.g. 5 or 9.975)')
	.max(100, 'rate must be at most 100 (a percent, e.g. 5 or 9.975)')
	.refine((v) => Math.abs(Math.round(v * 1000) - v * 1000) < 1e-6, 'rate takes at most 3 decimals (e.g. 9.975)');

function checkRateOnly(r: { country: string; type: string; region?: string | null | undefined; label?: string | null | undefined }):
	| { value: { country: string; type: string; region: string | null; label: string | null } }
	| { problem: string; path: string } {
	const country = regions.normalizeCountry(r.country);
	if (!country) return { problem: 'country is required', path: 'country' };
	const label = r.label?.trim() || null;
	const rawRegion = r.region?.trim().toUpperCase().replace(new RegExp(`^${country}-`), '') || null;
	const rules = regions.get(country);
	if (!rules?.taxIds) return { value: { country, type: r.type.trim(), region: rawRegion ? `${country}-${rawRegion}` : null, label } };
	const rule = rules.taxIds[r.type];
	if (!rule) return { problem: `${country} has no '${r.type}' registration (one of: ${Object.keys(rules.taxIds).join(', ')})`, path: 'type' };
	let region: string | null = rule.region ?? null;
	if (rule.regions) {
		if (!rawRegion || !rule.regions.includes(rawRegion)) {
			return { problem: `${rule.label} needs its ${rules.subdivisionLabel ?? 'region'}: one of ${rule.regions.map((x) => `${country}-${x}`).join(', ')}`, path: 'region' };
		}
		region = rawRegion;
	}
	return { value: { country, type: r.type, region: region ? `${country}-${region}` : null, label } };
}

const taxRegistration = z
	.object({
		country: z.string().trim().min(2).max(60),
		type: z.string().trim().min(1).max(40),
		number: z.string().trim().max(40).nullable().optional(),
		region: z.string().max(10).nullable().optional(),
		label: z.string().max(40).nullable().optional(),
		rate: rate.nullable().optional(),
	})
	.transform((r, ctx) => {
		const rateOut = r.rate ?? null;
		const number = r.number?.trim() || null;
		if (!number) {
			if (rateOut === null) {
				ctx.addIssue({ code: 'custom', path: ['number'], message: 'number or rate is required' });
				return { ...r, number: '', region: r.region ?? null, label: r.label ?? null, rate: rateOut };
			}
			const checked = checkRateOnly(r);
			if ('problem' in checked) {
				ctx.addIssue({ code: 'custom', path: [checked.path], message: checked.problem });
				return { ...r, number: '', region: r.region ?? null, label: r.label ?? null, rate: rateOut };
			}
			return { ...checked.value, number: '', rate: rateOut };
		}
		const checked = regions.checkTaxRegistration({ country: r.country, type: r.type, number, region: r.region ?? null, label: r.label ?? null });
		if ('problem' in checked) {
			ctx.addIssue({ code: 'custom', path: ['number'], message: checked.problem });
			return { ...r, number, region: r.region ?? null, label: r.label ?? null, rate: rateOut };
		}
		return { ...checked.value, rate: rateOut };
	});

// The sector / trade the business works in, as the app's own key ('plumbing',
// 'moving', 'home_cleaning') — no list is built in: each app supplies its own.
const industry = z
	.string()
	.trim()
	.toLowerCase()
	.max(40)
	.regex(/^[a-z0-9_-]+$/, "industry is a key of lowercase letters, digits, '_' or '-' (e.g. 'plumbing')");

// What goes before a document's number, per kind of document: { invoice:
// 'ACME', job: 'ACME-JOB' } → ACME-INV-0042. Upper-cased; null clears the map.
export const DOCUMENT_PREFIX_KINDS_MAX = 10;
const documentPrefixes = z
	.record(
		z.string().regex(/^[a-z_]{1,20}$/, "a document kind is 1–20 lowercase letters or '_' (e.g. 'invoice')"),
		z
			.string()
			.trim()
			.transform((v) => v.toUpperCase())
			.pipe(z.string().max(10, 'a prefix is at most 10 characters').regex(/^[A-Z0-9-]*$/, "a prefix holds only letters, digits and '-'")),
	)
	.refine((m) => Object.keys(m).length <= DOCUMENT_PREFIX_KINDS_MAX, `at most ${DOCUMENT_PREFIX_KINDS_MAX} document kinds`)
	// An emptied prefix is no prefix: drop it rather than store ''.
	.transform((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.length > 0)));

export const updateWorkspaceSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		description: z.string().max(2000).nullable().optional(),
		motto: z.string().max(300).nullable().optional(),
		phone: z.string().max(32).nullable().optional(),
		businessType: z.enum(BUSINESS_TYPES).nullable().optional(),
		industry: industry.nullable().optional(),
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
		documentPrefixes: documentPrefixes.nullable().optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'No settings provided');

// ── Contacts & locations ────────────────────────────────────────────────────

// '+1 (514) 555-0100' → '+15145550100'. International format only: a number
// without its country code is ambiguous once a business works across borders.
const e164 = z
	.string()
	.trim()
	.transform((v) => v.replace(/[\s().-]/g, ''))
	.pipe(z.string().regex(/^\+[1-9][0-9]{6,14}$/, 'Not a phone number in international format (e.g. +15145550100)'));
const contactLabel = z.string().trim().max(100).nullable().optional();
const position = z.number().int().min(0).max(32767);
const lowerEmail = email.transform((v) => v.toLowerCase()).pipe(z.string().max(254));
const atLeastOne = (o: Record<string, unknown>) => Object.values(o).some((v) => v !== undefined);

export const addWorkspaceEmailSchema = z.object({
	email: lowerEmail,
	label: contactLabel,
	isPrimary: z.boolean().optional(),
});

export const updateWorkspaceEmailSchema = z
	.object({ label: contactLabel, isPrimary: z.boolean().optional(), position: position.optional() })
	.refine(atLeastOne, 'Provide at least one field');

const extension = z.string().trim().regex(/^[0-9]{1,8}$/, 'An extension is 1–8 digits').nullable().optional();

export const addWorkspacePhoneSchema = z.object({
	phone: e164,
	extension,
	label: contactLabel,
	isPrimary: z.boolean().optional(),
});

export const updateWorkspacePhoneSchema = z
	.object({ extension, label: contactLabel, isPrimary: z.boolean().optional(), position: position.optional() })
	.refine(atLeastOne, 'Provide at least one field');

// 'qc' → 'CA-QC' needs the country; a full code ('CA-QC') is checked against
// the country's subdivisions when it has a pack (CA, US).
const taxRegion = z
	.string()
	.trim()
	.transform((v) => v.toUpperCase())
	.pipe(z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/, "A tax region is an ISO 3166-2 code (e.g. 'CA-QC', 'US-NY')"))
	.superRefine((v, ctx) => {
		const [country, sub] = v.split('-') as [string, string];
		const subs = regions.get(country)?.subdivisions;
		if (subs && !subs[sub]) ctx.addIssue({ code: 'custom', message: `'${v}' is not a ${regions.get(country)?.subdivisionLabel ?? 'subdivision'} of ${country}` });
	});

const locationFields = {
	name: z.string().trim().min(1, 'name is required').max(100),
	address: addressSchema,
	taxRegion: taxRegion.nullable().optional(),
	latitude: z.number().min(-90).max(90).nullable().optional(),
	longitude: z.number().min(-180).max(180).nullable().optional(),
	phone: e164.nullable().optional(),
	email: lowerEmail.nullable().optional(),
	isHeadOffice: z.boolean().optional(),
	position: position.optional(),
};

export const createWorkspaceLocationSchema = z.object(locationFields);

export const updateWorkspaceLocationSchema = z
	.object({
		name: locationFields.name.optional(),
		address: addressSchema.optional(),
		taxRegion: locationFields.taxRegion,
		latitude: locationFields.latitude,
		longitude: locationFields.longitude,
		phone: locationFields.phone,
		email: locationFields.email,
		isHeadOffice: locationFields.isHeadOffice,
		position: locationFields.position,
	})
	.refine(atLeastOne, 'Provide at least one field');

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
