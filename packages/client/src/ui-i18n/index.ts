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
import errorsEn from './errors/en';
import errorsEs from './errors/es';
import errorsFr from './errors/fr';
import errorsZhHans from './errors/zh-Hans';
import errorsZhHant from './errors/zh-Hant';
import { resolveUiLanguage, type UiLanguage } from './resolve';

export { UI_LANGUAGES, canonicalLocaleTag, formatPersonName, resolveUiLanguage } from './resolve';
export type { UiLanguage } from './resolve';

// The words of every prebuilt screen (React, React Native, Vue), one folder per
// domain, one file per language. English is canonical; each translation is
// typed against it, so a missing or extra key is a compile error.
const en = { auth: authEn, billing: billingEn, customers: customersEn, workspaces: workspacesEn, audit: auditEn, webhooks: webhooksEn, errors: errorsEn };
export type UiMessages = typeof en;

const dictionaries: Readonly<Record<UiLanguage, UiMessages>> = Object.freeze({
	en,
	fr: { auth: authFr, billing: billingFr, customers: customersFr, workspaces: workspacesFr, audit: auditFr, webhooks: webhooksFr, errors: errorsFr },
	es: { auth: authEs, billing: billingEs, customers: customersEs, workspaces: workspacesEs, audit: auditEs, webhooks: webhooksEs, errors: errorsEs },
	'zh-Hans': { auth: authZhHans, billing: billingZhHans, customers: customersZhHans, workspaces: workspacesZhHans, audit: auditZhHans, webhooks: webhooksZhHans, errors: errorsZhHans },
	'zh-Hant': { auth: authZhHant, billing: billingZhHant, customers: customersZhHant, workspaces: workspacesZhHant, audit: auditZhHant, webhooks: webhooksZhHant, errors: errorsZhHant },
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

/** The minimal shape of a refused request: FonderieApiError, or anything like it. */
export interface IApiErrorLike {
	reason?: string | undefined;
	explanation?: string | undefined;
	status?: number | undefined;
	details?: unknown;
}

const GENERIC_BY_STATUS: Record<number, keyof UiMessages['errors']['generic']> = {
	400: 'badRequest',
	401: 'unauthorized',
	402: 'paymentRequired',
	403: 'forbidden',
	404: 'notFound',
	409: 'conflict',
	413: 'tooLarge',
	422: 'validation',
	429: 'tooMany',
	501: 'unavailable',
	503: 'unavailable',
};

/**
 * What to show for a refused request, in the reader's language. English
 * readers get the server's own sentence (it is precise: "address.zip: '12345'
 * is not a postal code"). Other readers get the message for the error's reason
 * code, filled from its `details` — or, when the code is unknown or a value is
 * missing, the generic message for the status. Never a half-filled sentence,
 * and never English to someone who reads another language.
 */
export function localizeApiError(error: IApiErrorLike | null | undefined, locale: string | null | undefined): string {
	if (!error) return '';
	const lang = resolveUiLanguage(locale);
	const dict = dictionaries[lang].errors;
	// Status 0: the request never reached the server (offline, DNS). Its text
	// is a runtime message ("TypeError: Failed to fetch") — useless in any language.
	if (!error.status) return dict.generic.network;
	if (lang === 'en' && error.explanation) return error.explanation;
	const details = (error.details && typeof error.details === 'object' ? error.details : {}) as Record<string, unknown>;
	const template = error.reason ? (dict.reasons as Record<string, string>)[error.reason] : undefined;
	if (template) {
		let complete = true;
		const text = template.replace(/\{(\w+)\}/g, (_, name: string) => {
			const v = details[name];
			if (v === undefined || v === null || v === '') {
				complete = false;
				return '';
			}
			return String(v);
		});
		if (complete) return text;
	}
	const generic = GENERIC_BY_STATUS[error.status ?? 0] ?? ((error.status ?? 0) >= 500 ? 'server' : 'badRequest');
	return dict.generic[generic];
}
