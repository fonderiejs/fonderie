// Country rules for addresses and tax IDs, as DATA: one pack per country,
// looked up by ISO 3166-1 code. Bricks that store an address or a tax number
// (workspaces, customers) ask this registry and never hard-code a country.
// Fonderie ships Canada and the United States (region-data.ts); an app adds
// any other country with `regions.register({...})` at startup. A country with
// no pack is stored as given — never judged by another country's rules.

import { CANADA, UNITED_STATES } from './region-data';

export interface ISubdivisionRule {
	name: string;
	/** Other names it goes by, any language — e.g. 'Québec' for QC. Matched accent- and case-insensitively. */
	aliases?: string[];
}

export interface ITaxIdRule {
	/** Shown in pickers and on documents, e.g. 'GST/HST'. */
	label: string;
	/** Tested against the number upper-cased with spaces, dots and dashes removed. Absent: any non-empty number. */
	pattern?: RegExp;
	/** How to store/display a number that matched, given its compact form. Default: the compact form. */
	format?: (compact: string) => string;
	/** Shown when the number does not match, e.g. '123456789RT0001'. */
	example?: string;
	/** The registration only exists per subdivision: one of these codes is required as its region. */
	regions?: string[];
	/** The registration always belongs to this subdivision (e.g. QST → 'QC'). */
	region?: string;
}

export interface ICountryRules {
	/** ISO 3166-1 alpha-2, e.g. 'CA'. */
	code: string;
	/** Names it goes by, any language — 'Canada', 'États-Unis', 'USA'. */
	names?: string[];
	/** By ISO 3166-2 code without the country prefix ('QC', not 'CA-QC'). */
	subdivisions?: Record<string, ISubdivisionRule>;
	/** 'province or territory', 'state' — used in messages. */
	subdivisionLabel?: string;
	postalCode?: { pattern: RegExp; format?: (compact: string) => string; example: string; label?: string };
	/** The tax registrations this country has, by type key ('GST_HST', 'EIN', …). */
	taxIds?: Record<string, ITaxIdRule>;
}

// 'Québec' and 'QUEBEC' compare equal; so do 'Île' and 'ILE'.
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim();
const compactOf = (s: string) => s.replace(/[\s.\-]/g, '').toUpperCase();

export interface IAddressProblem {
	field: 'country' | 'subdivision' | 'postalCode';
	message: string;
}

export interface ITaxRegistration {
	/** ISO 3166-1 country of the registration. */
	country: string;
	/** A key of that country's taxIds ('GST_HST', 'EIN'…), or any label when the country has no pack. */
	type: string;
	number: string;
	/** ISO 3166-2 subdivision, e.g. 'CA-QC', 'US-NY'. */
	region?: string | null;
	/** Shown on documents instead of the type's label, e.g. 'TPS/TVH'. */
	label?: string | null;
}

export class RegionRegistry {
	private readonly byCode = new Map<string, ICountryRules>();
	private readonly byName = new Map<string, string>();

	constructor(packs: ICountryRules[] = []) {
		for (const p of packs) this.register(p);
	}

	/** Add or replace a country's rules. */
	register(rules: ICountryRules): this {
		const code = rules.code.toUpperCase();
		this.byCode.set(code, { ...rules, code });
		for (const n of [code, ...(rules.names ?? [])]) this.byName.set(fold(n), code);
		return this;
	}

	get(country: string | null | undefined): ICountryRules | undefined {
		return country ? this.byCode.get(country.toUpperCase()) : undefined;
	}

	/** Countries with a pack, by code. */
	countries(): string[] {
		return [...this.byCode.keys()];
	}

	/** 'Canada' / 'can' → 'CA' for a registered country; any other 2-letter code upper-cased; else as given. */
	normalizeCountry(country: string | null | undefined): string | null {
		const t = country?.trim();
		if (!t) return null;
		const known = this.byName.get(fold(t));
		if (known) return known;
		return /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : t;
	}

	/** 'Québec' / 'qc' / 'CA-QC' → 'QC'. Null when the country has subdivisions and this is none of them. */
	normalizeSubdivision(country: string | null, subdivision: string | null | undefined): string | null {
		const t = subdivision?.trim();
		if (!t) return null;
		const subs = this.get(country)?.subdivisions;
		if (!subs) return t;
		const code = t.toUpperCase().replace(new RegExp(`^${country}-`), '');
		if (subs[code]) return code;
		const f = fold(t);
		for (const [c, s] of Object.entries(subs)) {
			if ([s.name, ...(s.aliases ?? [])].some((n) => fold(n) === f)) return c;
		}
		return null;
	}

	/** Formatted postal code, or null when the country has a pattern and this does not match it. */
	normalizePostalCode(country: string | null, postal: string | null | undefined): string | null {
		const t = postal?.trim();
		if (!t) return null;
		const rule = this.get(country)?.postalCode;
		if (!rule) return t;
		const compact = t.replace(/[\s-]/g, '').toUpperCase();
		if (!rule.pattern.test(compact)) return null;
		return rule.format ? rule.format(compact) : compact;
	}

	/**
	 * Normalize an address and say what is wrong with it, by its country's
	 * rules. Empty fields are not problems — an address can be saved partially.
	 */
	checkAddress(input: { country?: string | null; subdivision?: string | null; postalCode?: string | null }): {
		country: string | null;
		subdivision: string | null;
		postalCode: string | null;
		problems: IAddressProblem[];
	} {
		const country = this.normalizeCountry(input.country);
		const rules = this.get(country);
		const problems: IAddressProblem[] = [];
		let subdivision = input.subdivision?.trim() || null;
		let postalCode = input.postalCode?.trim() || null;
		if (rules && subdivision) {
			const s = this.normalizeSubdivision(country, subdivision);
			if (s) subdivision = s;
			else problems.push({ field: 'subdivision', message: `'${subdivision}' is not a ${rules.subdivisionLabel ?? 'subdivision'} of ${country}` });
		}
		if (rules && postalCode) {
			const p = this.normalizePostalCode(country, postalCode);
			if (p) postalCode = p;
			else if (rules.postalCode) problems.push({ field: 'postalCode', message: `'${postalCode}' is not a ${rules.postalCode.label ?? 'postal code'} (${rules.postalCode.example})` });
		}
		return { country, subdivision, postalCode, problems };
	}

	/** A normalized tax registration, or why it is invalid — by its country's rules. */
	checkTaxRegistration(r: ITaxRegistration): { value: Required<ITaxRegistration> } | { problem: string } {
		const country = this.normalizeCountry(r.country);
		if (!country) return { problem: 'country is required' };
		const label = r.label?.trim() || null;
		const rawRegion = r.region?.trim().toUpperCase().replace(new RegExp(`^${country}-`), '') || null;
		const rules = this.get(country);
		const number = r.number.trim();
		if (!number) return { problem: 'number is required' };
		if (!rules?.taxIds) {
			// No pack for this country: store as given.
			return { value: { country, type: r.type.trim(), number, region: rawRegion ? `${country}-${rawRegion}` : null, label } };
		}
		const rule = rules.taxIds[r.type];
		if (!rule) return { problem: `${country} has no '${r.type}' registration (one of: ${Object.keys(rules.taxIds).join(', ')})` };
		const compact = compactOf(number);
		if (rule.pattern && !rule.pattern.test(compact)) {
			return { problem: `Not a valid ${rule.label} number${rule.example ? ` (e.g. ${rule.example})` : ''}` };
		}
		let region: string | null = rule.region ?? null;
		if (rule.regions) {
			if (!rawRegion || !rule.regions.includes(rawRegion)) {
				return { problem: `${rule.label} needs its ${rules.subdivisionLabel ?? 'region'}: one of ${rule.regions.map((x) => `${country}-${x}`).join(', ')}` };
			}
			region = rawRegion;
		}
		return {
			value: {
				country,
				type: r.type,
				number: rule.pattern ? (rule.format ? rule.format(compact) : compact) : number,
				region: region ? `${country}-${region}` : null,
				label,
			},
		};
	}
}

/** The registry the bricks use. Add countries with `regions.register({...})` at startup. */
export const regions = new RegionRegistry([CANADA, UNITED_STATES]);

export { CANADA, UNITED_STATES };
