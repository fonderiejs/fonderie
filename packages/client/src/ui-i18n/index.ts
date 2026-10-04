import authEn from './auth/en';
import authEs from './auth/es';
import authFr from './auth/fr';
import authZhHans from './auth/zh-Hans';
import authZhHant from './auth/zh-Hant';
import billingEn from './billing/en';
import billingEs from './billing/es';
import billingFr from './billing/fr';
import billingZhHans from './billing/zh-Hans';
import billingZhHant from './billing/zh-Hant';
import customersEn from './customers/en';
import customersEs from './customers/es';
import customersFr from './customers/fr';
import customersZhHans from './customers/zh-Hans';
import customersZhHant from './customers/zh-Hant';
import workspacesEn from './workspaces/en';
import workspacesEs from './workspaces/es';
import workspacesFr from './workspaces/fr';
import workspacesZhHans from './workspaces/zh-Hans';
import workspacesZhHant from './workspaces/zh-Hant';
import auditEn from './audit/en';
import auditEs from './audit/es';
import auditFr from './audit/fr';
import auditZhHans from './audit/zh-Hans';
import auditZhHant from './audit/zh-Hant';
import webhooksEn from './webhooks/en';
import webhooksEs from './webhooks/es';
import webhooksFr from './webhooks/fr';
import webhooksZhHans from './webhooks/zh-Hans';
import webhooksZhHant from './webhooks/zh-Hant';
import { resolveUiLanguage, type UiLanguage } from './resolve';

export { UI_LANGUAGES, canonicalLocaleTag, formatPersonName, resolveUiLanguage } from './resolve';
export type { UiLanguage } from './resolve';

// The words of every prebuilt screen (React, React Native, Vue), one folder per
// domain, one file per language. English is canonical; each translation is
// typed against it, so a missing or extra key is a compile error.
const en = { auth: authEn, billing: billingEn, customers: customersEn, workspaces: workspacesEn, audit: auditEn, webhooks: webhooksEn };
export type UiMessages = typeof en;

const dictionaries: Readonly<Record<UiLanguage, UiMessages>> = Object.freeze({
	en,
	fr: { auth: authFr, billing: billingFr, customers: customersFr, workspaces: workspacesFr, audit: auditFr, webhooks: webhooksFr },
	es: { auth: authEs, billing: billingEs, customers: customersEs, workspaces: workspacesEs, audit: auditEs, webhooks: webhooksEs },
	'zh-Hans': { auth: authZhHans, billing: billingZhHans, customers: customersZhHans, workspaces: workspacesZhHans, audit: auditZhHans, webhooks: webhooksZhHans },
	'zh-Hant': { auth: authZhHant, billing: billingZhHant, customers: customersZhHant, workspaces: workspacesZhHant, audit: auditZhHant, webhooks: webhooksZhHant },
});

type MessagePath<T> = {
	[K in keyof T & string]: T[K] extends string ? K : T[K] extends object ? `${K}.${MessagePath<T[K]>}` : never;
}[keyof T & string];
/** Every dot-path to a string, e.g. 'auth.login.title'. */
export type UiMessageKey = MessagePath<UiMessages>;
export type UiMessageParams = Record<string, string | number>;
export type UiT = (key: UiMessageKey, params?: UiMessageParams) => string;

/**
 * A translator for a locale ('fr-CA', 'zh-TW'…): t('auth.login.title'),
 * t('auth.register.passwordTooShort', { min: 8 }). Falls back to English for a
 * language Fonderie does not ship, and renders a missing key as the key itself
 * — visible, never a crash.
 */
export function createUiT(locale: string | null | undefined): UiT {
	const dict = dictionaries[resolveUiLanguage(locale)];
	return (key, params) => {
		let node: unknown = dict;
		for (const part of key.split('.')) {
			if (node == null || typeof node !== 'object') break;
			node = (node as Record<string, unknown>)[part];
		}
		const text = typeof node === 'string' ? node : key;
		return params ? text.replace(/\{(\w+)\}/g, (m, n: string) => (n in params ? String(params[n]) : m)) : text;
	};
}

/** For the parity test: every shipped language's dictionary. */
export const UI_DICTIONARIES = dictionaries;
