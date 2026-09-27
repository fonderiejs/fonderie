import type { ITemplateCatalog, ITemplateCatalogEntry, ITemplateEntry } from './types';

// The template store keys rows by (type, locale), and the list endpoint returns
// them flat. An operator thinks in emails, not rows: "welcome, in English,
// French and Spanish". These helpers give every console the same grouping, so
// the React and Vue screens cannot disagree about order or suggestions.

/** One email and every locale it exists in. */
export interface ITemplateGroup {
	type: string;
	/** Default locale (null) first, then the rest alphabetically. */
	entries: ITemplateEntry[];
	/** The entry a click on the email itself should open: the default, else the first. */
	primary: ITemplateEntry;
	/** Built-in email (its default-locale row can never be deleted). */
	system: boolean;
}

const byLocale = (a: ITemplateEntry, b: ITemplateEntry): number =>
	a.locale === b.locale ? 0 : a.locale === null ? -1 : b.locale === null ? 1 : a.locale.localeCompare(b.locale);

/** Rows grouped by type, types in the order the server listed them. */
export function groupTemplatesByType(rows: readonly ITemplateEntry[]): ITemplateGroup[] {
	const groups = new Map<string, ITemplateEntry[]>();
	for (const row of rows) {
		const entries = groups.get(row.type);
		if (entries) entries.push(row);
		else groups.set(row.type, [row]);
	}
	return [...groups].map(([type, entries]) => {
		entries.sort(byLocale);
		const primary = entries[0] as ITemplateEntry;
		return { type, entries, primary, system: entries.some((e) => e.system === true) };
	});
}

/**
 * Locales the app already uses elsewhere that `type` has no version in yet —
 * what "Add locale" should suggest first. A French welcome email with no French
 * receipt is exactly the gap an operator is looking for.
 */
export function missingTemplateLocales(rows: readonly ITemplateEntry[], type: string): string[] {
	const has = new Set(rows.filter((r) => r.type === type).map((r) => r.locale));
	const used = new Set(rows.map((r) => r.locale).filter((l): l is string => l !== null && !has.has(l)));
	return [...used].sort();
}

// ── From the catalog (saved AND built-in) ─────────────────────────────────

/** One language an email exists in, as the console shows it. */
export interface ITemplateLanguage {
	/** What to open: null is the default version. */
	locale: string | null;
	/** What to show: the default version is labelled with the system locale. */
	label: string;
	/** The app saved this version (else it is Fonderie's built-in copy, untouched). */
	saved: boolean;
	/** Fonderie ships this language. */
	builtIn: boolean;
	/** A saved version switched off is skipped when sending. Built-in copy is always on. */
	active: boolean;
}

/**
 * Every language one email exists in, sorted by label — the default version
 * shown as the system locale ('en-US'), then e.g. 'es', 'fr', 'fr-CA'. A saved
 * version and the built-in copy of the same language are one entry: the saved
 * one is what sends.
 */
export function templateLanguages(email: ITemplateCatalogEntry, defaultLocale: string): ITemplateLanguage[] {
	const out = new Map<string, ITemplateLanguage>();
	const saved = new Map(email.versions.map((v) => [v.locale, v]));
	const base = saved.get(null);
	if (base || email.builtIn.default) {
		out.set('', {
			locale: null,
			label: defaultLocale,
			saved: Boolean(base),
			builtIn: email.builtIn.default,
			active: base ? base.active : true,
		});
	}
	for (const lang of email.builtIn.languages) {
		const own = saved.get(lang);
		out.set(lang, { locale: lang, label: lang, saved: Boolean(own), builtIn: true, active: own ? own.active : true });
	}
	for (const v of email.versions) {
		if (v.locale === null || out.has(v.locale)) continue;
		out.set(v.locale, { locale: v.locale, label: v.locale, saved: true, builtIn: false, active: v.active });
	}
	return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * What "Add locale" should suggest for `type`: locales the app already uses on
 * other emails (saved or built-in) that this one lacks. Never the system locale
 * — the default version already is that locale.
 */
export function suggestTemplateLocales(catalog: ITemplateCatalog, type: string): string[] {
	const email = catalog.emails.find((e) => e.type === type);
	const has = new Set(email ? templateLanguages(email, catalog.defaultLocale).map((l) => l.label) : []);
	const used = new Set<string>();
	for (const e of catalog.emails) {
		for (const l of templateLanguages(e, catalog.defaultLocale)) {
			if (l.locale !== null && !has.has(l.label)) used.add(l.label);
		}
	}
	return [...used].sort();
}
