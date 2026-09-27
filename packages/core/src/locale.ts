import type { IDefaultTemplate, IDefaultTemplateCopy } from './types';

// The app's locales: which one is the system locale, and where each market's
// content comes from when it has none of its own. Lives in core, not in a brick,
// because every brick that holds per-locale content — email copy today, legal
// documents or receipts tomorrow — must give the same answer to "what does a
// fr-BE user get?", and auth already defaults new users to a locale.
//
// A locale here is a market as much as a language: en-US and en-CA can carry
// different terms. So content never falls back to a sibling market on its own —
// only along a chain the app declared, then to the system locale.

export interface ILocaleConfig {
	/** The system locale: what the default (untagged) content is written in. Default 'en-US'. */
	default?: string;
	/**
	 * Where a locale's content comes from when it has none of its own, in order,
	 * before the system locale. Keys are a full locale ('fr-BE') or a bare
	 * language ('fr'); a full locale wins over its language. Chains do not
	 * expand: 'fr-BE' → ['fr-FR'] never also follows fr-FR's own chain, so the
	 * path a market's content takes is readable in one line.
	 */
	fallbacks?: Record<string, string | readonly string[]>;
}

/** The validated, canonical form every brick reads. */
export interface ILocaleSettings {
	readonly default: string;
	readonly fallbacks: Readonly<Record<string, readonly string[]>>;
}

export const DEFAULT_SYSTEM_LOCALE = 'en-US';
/** Longest fallback list a locale may declare — a longer chain is a mistake, not a policy. */
export const MAX_LOCALE_FALLBACKS = 5;

/**
 * The canonical spelling of a BCP 47 tag ('EN-us' → 'en-US'), or null when it is
 * not one. Matching is on this form, so 'en-us' and 'en-US' are the same locale.
 */
export function canonicalLocale(tag: string | null | undefined): string | null {
	if (!tag || typeof tag !== 'string') return null;
	try {
		return Intl.getCanonicalLocales(tag.trim())[0] ?? null;
	} catch {
		return null;
	}
}

/** The language subtag: 'fr-CA' → 'fr'. */
export function localeLanguage(tag: string): string {
	return tag.split('-')[0]?.toLowerCase() ?? tag;
}

/**
 * Validate and canonicalize. Throws naming the bad entry, so a mistake stops the
 * app at startup instead of quietly sending the wrong market's content.
 */
export function defineLocales(config: ILocaleConfig = {}): ILocaleSettings {
	const system = canonicalLocale(config.default ?? DEFAULT_SYSTEM_LOCALE);
	if (!system) throw new Error(`locales.default: "${config.default}" is not a valid locale tag`);
	const fallbacks: Record<string, readonly string[]> = {};
	for (const [rawKey, rawValue] of Object.entries(config.fallbacks ?? {})) {
		const key = canonicalLocale(rawKey);
		if (!key) throw new Error(`locales.fallbacks: "${rawKey}" is not a valid locale tag`);
		if (key in fallbacks) throw new Error(`locales.fallbacks: "${rawKey}" is declared twice`);
		const list = typeof rawValue === 'string' ? [rawValue] : [...rawValue];
		if (list.length === 0) throw new Error(`locales.fallbacks["${rawKey}"]: empty list`);
		if (list.length > MAX_LOCALE_FALLBACKS) {
			throw new Error(
				`locales.fallbacks["${rawKey}"]: ${list.length} fallbacks, at most ${MAX_LOCALE_FALLBACKS}`,
			);
		}
		const chain: string[] = [];
		for (const raw of list) {
			const tag = canonicalLocale(raw);
			if (!tag) throw new Error(`locales.fallbacks["${rawKey}"]: "${raw}" is not a valid locale tag`);
			if (tag === key) throw new Error(`locales.fallbacks["${rawKey}"]: falls back to itself`);
			if (chain.includes(tag)) throw new Error(`locales.fallbacks["${rawKey}"]: "${raw}" is listed twice`);
			chain.push(tag);
		}
		fallbacks[key] = Object.freeze(chain);
	}
	return Object.freeze({ default: system, fallbacks: Object.freeze(fallbacks) });
}

/**
 * The locales to try for `requested`, in order, EXCLUDING the system locale —
 * which every caller tries last, after its own non-default sources. Empty when
 * nothing was requested, the tag is invalid, or it is the system locale itself.
 *
 *   requested 'fr-BE', fallbacks { 'fr-BE': ['fr-FR','fr-CA'] }  → ['fr-BE','fr-FR','fr-CA']
 *   requested 'fr-CH', fallbacks { fr: 'fr-CA' }                 → ['fr-CH','fr-CA']
 *   requested 'en-ZH', no fallbacks                               → ['en-ZH']
 */
export function localeChain(requested: string | null | undefined, settings: ILocaleSettings): string[] {
	const tag = canonicalLocale(requested);
	if (!tag || tag === settings.default) return [];
	const declared = settings.fallbacks[tag] ?? settings.fallbacks[localeLanguage(tag)] ?? [];
	return [tag, ...declared].filter((t, i, all) => t !== settings.default && all.indexOf(t) === i);
}

/**
 * Attach translations to a module's English defaults. Each translation map is
 * typed against the same keys, so a missing French email is a compile error in
 * the module that ships it — the same guarantee the English map already has.
 *
 *   export const DEFAULT_TEMPLATES = withTranslations(EN, { fr: FR, es: ES });
 */
export function withTranslations<K extends string>(
	english: Record<K, IDefaultTemplate>,
	translations: Record<string, Record<K, IDefaultTemplateCopy>>,
): Record<K, IDefaultTemplate> {
	const out = {} as Record<K, IDefaultTemplate>;
	for (const key of Object.keys(english) as K[]) {
		const locales: Record<string, IDefaultTemplateCopy> = {};
		for (const [lang, map] of Object.entries(translations)) locales[lang] = map[key];
		out[key] = { ...english[key], locales };
	}
	return out;
}

/** The languages every Fonderie module ships its built-in emails in, besides English. */
export const SHIPPED_TEMPLATE_LANGUAGES: readonly string[] = Object.freeze(['es', 'fr']);

const TEMPLATE_VAR_RE = /\{\{#?\/?(\w+)\}\}/g;
const varsOf = (part: string | undefined): string =>
	[...new Set([...(part ?? '').matchAll(TEMPLATE_VAR_RE)].map((m) => m[1] as string))].sort().join(',');

/**
 * Everything wrong with a module's translations, as readable lines — empty when
 * sound. A translation must exist for every shipped language, have the same
 * parts as the English (a subject, an html body) and use exactly the same
 * {{variables}}: a French password reset without {{pin}} renders, sends, and
 * locks the user out. Each module's templates.test.ts asserts this is empty.
 */
export function translationProblems(
	defaults: Readonly<Record<string, IDefaultTemplate>>,
	languages: readonly string[] = SHIPPED_TEMPLATE_LANGUAGES,
): string[] {
	const problems: string[] = [];
	for (const [key, en] of Object.entries(defaults)) {
		for (const lang of languages) {
			const t = en.locales?.[lang];
			if (!t) {
				problems.push(`${key}: no ${lang} copy`);
				continue;
			}
			if (Boolean(en.subject) !== Boolean(t.subject)) problems.push(`${key} (${lang}): subject differs in presence`);
			if (Boolean(en.html) !== Boolean(t.html)) problems.push(`${key} (${lang}): html differs in presence`);
			// Per part, not pooled: a code present in the HTML but dropped from the
			// plain text still leaves text-only readers without it.
			for (const part of ['subject', 'text', 'html'] as const) {
				const want = varsOf(en[part]);
				const got = varsOf(t[part]);
				if (want !== got) problems.push(`${key} (${lang}): ${part} variables [${got}] ≠ English [${want}]`);
			}
		}
	}
	return problems;
}
