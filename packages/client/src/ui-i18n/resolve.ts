// Which of the shipped UI languages a tag reads, with no dependency on
// @fonderie/core (the client runs in browsers and React Native).

export const UI_LANGUAGES = ['en', 'fr', 'es', 'zh-Hans', 'zh-Hant'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

/** 'FR-ca' → 'fr-CA'; null when not a BCP 47 tag. */
export function canonicalLocaleTag(tag: string | null | undefined): string | null {
	if (!tag || typeof tag !== 'string') return null;
	try {
		return Intl.getCanonicalLocales(tag.trim())[0] ?? null;
	} catch {
		return null;
	}
}

/**
 * The shipped language to show for a tag: 'fr-CA' → 'fr', 'es-US' → 'es',
 * Chinese by script ('zh-TW' / 'zh-HK' / 'zh-MO' → 'zh-Hant', 'zh' / 'zh-CN' /
 * 'zh-SG' → 'zh-Hans'), anything else → 'en'.
 */
export function resolveUiLanguage(tag: string | null | undefined): UiLanguage {
	const c = canonicalLocaleTag(tag);
	if (!c) return 'en';
	const base = c.split('-')[0]!.toLowerCase();
	if (base === 'zh') {
		let script: string | undefined;
		try {
			script = new Intl.Locale(c).maximize().script;
		} catch {
			script = undefined;
		}
		return script === 'Hant' ? 'zh-Hant' : 'zh-Hans';
	}
	return (UI_LANGUAGES as readonly string[]).includes(base) ? (base as UiLanguage) : 'en';
}

const FAMILY_NAME_FIRST = new Set(['zh', 'ja', 'ko']);

/**
 * A person's name in the order a language writes it: '王小明' for Chinese,
 * Japanese, Korean (family name first, no space), 'Marie Tremblay' otherwise.
 * Empty when there is neither part.
 */
export function formatPersonName(firstName: string | null | undefined, lastName: string | null | undefined, locale: string | null | undefined): string {
	const first = firstName?.trim() ?? '';
	const last = lastName?.trim() ?? '';
	const lang = (canonicalLocaleTag(locale) ?? '').split('-')[0]!.toLowerCase();
	return FAMILY_NAME_FIRST.has(lang) ? `${last}${first}` : [first, last].filter(Boolean).join(' ');
}
