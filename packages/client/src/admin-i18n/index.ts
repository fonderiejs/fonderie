import en from './en';
import es from './es';
import fr from './fr';
import zhHans from './zh-Hans';
import zhHant from './zh-Hant';

// The admin console's own language — the OPERATOR's preference, independent
// of the locales the app serves its customers. A founder in France can run
// the console in French while every customer email stays English.
//
// English is canonical: its shape defines the key space, and fr/es are typed
// against it (so are zh-Hans and zh-Hant), so a missing or extra key is a compile error (the pattern the
// reference app uses for its own UI).

export const ADMIN_LOCALES = ['en', 'fr', 'es', 'zh-Hans', 'zh-Hant'] as const;
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
	'zh-Hans': '简体中文',
	'zh-Hant': '繁體中文',
});

/** BCP 47 tags for Intl (dates, numbers). */
export const adminLocaleTags: LocaleMap<string> = Object.freeze({
	en: 'en-US',
	fr: 'fr-FR',
	es: 'es-ES',
	'zh-Hans': 'zh-Hans',
	'zh-Hant': 'zh-Hant',
});

export const isAdminLocale = (value: unknown): value is AdminLocale =>
	(ADMIN_LOCALES as readonly unknown[]).includes(value);

/**
 * The first supported language in a browser's preference list, else English.
 * Chinese goes by script: zh-TW / zh-HK / zh-MO → Traditional, zh / zh-CN /
 * zh-SG → Simplified (CLDR likely subtags, via Intl.Locale#maximize).
 */
export function detectAdminLocale(languages: readonly string[] = []): AdminLocale {
	for (const tag of languages) {
		const base = tag.toLowerCase().split('-')[0];
		if (base === 'zh') {
			let script: string | undefined;
			try {
				script = new Intl.Locale(tag).maximize().script;
			} catch {
				script = undefined;
			}
			return script === 'Hant' ? 'zh-Hant' : 'zh-Hans';
		}
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

const dictionaries: LocaleMap<AdminMessages> = { en, fr, es, 'zh-Hans': zhHans, 'zh-Hant': zhHant };

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

/** What the server sends: an English message, optionally with a reason (AIP-193 style). */
export interface IReasonLike {
	message: string;
	reason?: string | undefined;
	domain?: string | undefined;
	metadata?: Readonly<Record<string, string | number>> | undefined;
}

/**
 * A server message in the console's language. Looks up
 * reasons.<domain>.<REASON>, interpolates the metadata — translating enum-like
 * values through reasons.values.<key>.<VALUE> — and falls back to the English
 * `message` when this console has no sentence for that reason (a newer brick,
 * or an app's own check). Never renders a bare key.
 */
export function localizeReason(
	item: IReasonLike,
	locale: AdminLocale | undefined = DEFAULT_ADMIN_LOCALE,
): string {
	if (!item.reason || !item.domain) return item.message;
	const dict = (dictionaries[locale] ?? dictionaries[DEFAULT_ADMIN_LOCALE])
		.reasons as unknown as Record<string, Record<string, unknown>>;
	const text = dict[item.domain]?.[item.reason];
	if (typeof text !== 'string') return item.message;
	const values = dict['values'] as unknown as Record<string, Record<string, string>> | undefined;
	const meta = item.metadata ?? {};
	return text.replace(/\{(\w+)\}/g, (m, name: string) => {
		if (!(name in meta)) return m;
		const raw = String(meta[name]);
		return values?.[name]?.[raw] ?? raw;
	});
}

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
