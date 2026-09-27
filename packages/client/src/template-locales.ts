import type { ITemplateEntry } from './types';

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
