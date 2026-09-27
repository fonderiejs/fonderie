import en from './en';
import es from './es';
import fr from './fr';

// The admin console's own language — the OPERATOR's preference, independent
// of the locales the app serves its customers. A founder in France can run
// the console in French while every customer email stays English.
//
// English is canonical: its shape defines the key space, and fr/es are typed
// against it, so a missing or extra key is a compile error (the pattern the
// reference app uses for its own UI).

export const ADMIN_LOCALES = ['en', 'fr', 'es'] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const DEFAULT_ADMIN_LOCALE: AdminLocale = 'en';

/**
 * One value per console language, read-only. Frozen at runtime too: these
 * maps are shared by every console on the page, so an embedding app must not
 * be able to rename "Français" for everyone by assignment.
 */
export type LocaleMap<T> = Readonly<Record<AdminLocale, T>>;

/** Native-language names, for the language menu. */
export const adminLocaleNames: LocaleMap<string> = Object.freeze({
	en: 'English',
	fr: 'Français',
	es: 'Español',
});

/** BCP 47 tags for Intl (dates, numbers). */
export const adminLocaleTags: LocaleMap<string> = Object.freeze({
	en: 'en-US',
	fr: 'fr-FR',
	es: 'es-ES',
});

export const isAdminLocale = (value: unknown): value is AdminLocale =>
	(ADMIN_LOCALES as readonly unknown[]).includes(value);

/** The first supported language in a browser's preference list, else English. */
export function detectAdminLocale(languages: readonly string[] = []): AdminLocale {
	for (const tag of languages) {
		const base = tag.toLowerCase().split('-')[0];
		if (isAdminLocale(base)) return base;
	}
	return DEFAULT_ADMIN_LOCALE;
}

export type AdminMessages = typeof en;
type MessagePath<T> = {
	[K in keyof T & string]: T[K] extends string
		? K
		: T[K] extends object
			? `${K}.${MessagePath<T[K]>}`
			: never;
}[keyof T & string];
/** Every dot-path to a string in the dictionary, e.g. 'users.title'. */
export type AdminMessageKey = MessagePath<AdminMessages>;
export type AdminMessageParams = Record<string, string | number>;

const dictionaries: LocaleMap<AdminMessages> = { en, fr, es };

/**
 * A translator for one locale: t('users.title'), t('users.count', { n: 3 }).
 * A missing key renders the key itself — visible, never a crash. `{name}`
 * placeholders are interpolated from params.
 */
export function createAdminT(locale: AdminLocale | undefined = DEFAULT_ADMIN_LOCALE) {
	const dict = dictionaries[locale] ?? dictionaries[DEFAULT_ADMIN_LOCALE];
	const t = (key: AdminMessageKey, params?: AdminMessageParams): string => {
		let node: unknown = dict;
		for (const part of key.split('.')) {
			if (node == null || typeof node !== 'object') break;
			node = (node as Record<string, unknown>)[part];
		}
		const text = typeof node === 'string' ? node : key;
		return params
			? text.replace(/\{(\w+)\}/g, (m, n: string) => (n in params ? String(params[n]) : m))
			: text;
	};
	return t;
}
export type AdminT = ReturnType<typeof createAdminT>;

/** Dates in the console's language: 'date', 'datetime' or 'time'. */
export function formatAdminDate(
	value: string | number | Date,
	locale: AdminLocale | undefined = DEFAULT_ADMIN_LOCALE,
	style: 'date' | 'datetime' | 'time' = 'datetime',
): string {
	const d = value instanceof Date ? value : new Date(value);
	const tag = adminLocaleTags[locale] ?? adminLocaleTags.en;
	if (style === 'date') return d.toLocaleDateString(tag);
	if (style === 'time') return d.toLocaleTimeString(tag);
	return d.toLocaleString(tag);
}
