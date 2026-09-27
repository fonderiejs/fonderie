import { canonicalLocale, defineLocales, localeChain, localeLanguage } from '@fonderie/core';
import type { IDefaultTemplateCopy, ILocaleSettings } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type {
	ITemplateResolver,
	IRenderedTemplate,
	IDefaultTemplate,
	DefaultTemplateMap,
} from '../types';
import { EMAIL_THEME, defaultEmailLayout, wrapLayout } from './layout';

// The stored template id for a founder-supplied layout shell (DB row `type` or
// FS file `_layout.html`). Absent → the built-in DEFAULT_EMAIL_LAYOUT is used.
const LAYOUT_TYPE = '_layout';

// HTML-entity-escape interpolated VALUES in html templates. Template markup
// itself is trusted (authored by the app/module); the DATA is not — e.g.
// {{firstName}} is registration-controlled, and unescaped it lets a user
// inject markup/links into platform-branded emails (phishing content with the
// platform's own sender reputation). Text/subject parts stay raw: they are
// not HTML contexts.
//
// SCOPE: this escaping is correct for element content and QUOTED attribute
// values (it escapes & < > " '). It is NOT a URL/scheme sanitizer and does not
// cover UNQUOTED attributes. A template must therefore never interpolate a
// value into an unquoted attribute, and any `<a href="{{url}}">` link template
// must validate the scheme itself (allow http/https only) — a `{{url}}` of
// `javascript:…` passes this escaper unchanged. No shipped module template
// interpolates into an attribute; this is a guardrail for app authors.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// The template contract in one place: a variable is {{word}}, a section is
// {{#word}}…{{/word}}. \w+ only — {{ spaced }} and {{dotted.path}} are left
// alone, deliberately. Named because the renderer is no longer the only thing
// that reads it: an editor asking "which variables does this use?" must agree
// with what substitution will actually do, or it offers the wrong fields.
const VAR_RE = /\{\{(\w+)\}\}/g;
const SECTION_RE = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

// Every variable a template refers to, in first-seen order — section names
// included, since a section's presence is driven by the same data key.
// Implicit ones the layout injects ({{subject}}, {{preheader}}, {{brandName}})
// are NOT filtered here; the caller knows whether it supplies them.
export function templateVariables(...parts: Array<string | null | undefined>): string[] {
	const found = new Set<string>();
	for (const part of parts) {
		if (!part) continue;
		// Fresh regexes: the shared ones carry /g, so lastIndex would leak
		// between calls.
		for (const m of part.matchAll(new RegExp(SECTION_RE.source, 'g'))) found.add(m[1] as string);
		for (const m of part.matchAll(new RegExp(VAR_RE.source, 'g'))) found.add(m[1] as string);
	}
	return [...found];
}

/**
 * Optional blocks: `{{#key}}…{{/key}}` renders its body only when `key` has a
 * non-empty value.
 *
 * Needed because a template with no conditionals cannot omit anything, and some
 * fields are genuinely absent rather than empty — an invoice number exists only
 * when the charge went through an invoice. Without this, the choices are a
 * dangling "Invoice " with nothing after it, or an anchor with an empty href
 * that looks like a link and does nothing. Both are worse than saying less.
 *
 * Deliberately NOT a general template language: one construct, no nesting of the
 * same key, no expressions. Anything more and app authors start putting logic in
 * templates, which is how email rendering becomes unreviewable.
 *
 * Runs BEFORE variable substitution, so a value inside a section still
 * interpolates normally. Whitespace-only counts as absent — a provider returning
 * "" and one returning "  " should not render differently.
 */
function renderSections(template: string, data: Record<string, unknown>): string {
	return template.replace(SECTION_RE, (_, key: string, body: string) => {
		const value = data[key];
		const present = value !== undefined && value !== null && String(value).trim() !== '';
		return present ? body : '';
	});
}

function render(
	template: string,
	data: Record<string, unknown>,
	opts: { escapeHtml?: boolean } = {},
): string {
	return renderSections(template, data).replace(VAR_RE, (_, key: string) => {
		const value = data[key];
		if (value === undefined || value === null) return '';
		const s = String(value);
		return opts.escapeHtml ? escapeHtml(s) : s;
	});
}

// Compose a body fragment into its layout shell, then interpolate variables
// over the whole. `subject`/`preheader` become available to the shell's title
// and inbox preview text.
//
// `brandName` is the product the RECIPIENT believes they are hearing from — the
// app built on Fonderie, not Fonderie itself. A user who signed up for
// the app has never heard of Fonderie, so an email headed "Fonderie" reads
// as a different company at best and a phishing attempt at worst. Apps pass
// their own name; anything that does not falls back to EMAIL_THEME.brand, so
// the shell is never left with an empty heading.
//
// It interpolates like any other variable, which means it is HTML-escaped along
// with the rest — an app name containing & or < cannot break the shell.
function composeHtml(
	bodyHtml: string,
	layoutHtml: string | undefined,
	subject: string | undefined,
	data: Record<string, unknown>,
	language?: string,
): string {
	// No operator shell → the built-in one, in the email's own language.
	const wrapped = wrapLayout(bodyHtml, layoutHtml ?? defaultEmailLayout(language));
	return render(
		wrapped,
		{ subject: subject ?? '', preheader: '', brandName: EMAIL_THEME.brand, ...data },
		{ escapeHtml: true },
	);
}

// Render a resolved fragment — a DB row, an FS file set, or a MODULE DEFAULT —
// into the final template. Factored out so a module default renders
// byte-identically to a DB row: same {{var}} interpolation, same layout
// composition. `text` is required; `subject`/`html` are optional (email only).
export function renderFragment(
	frag: { subject?: string | null; text: string; html?: string | null },
	layoutHtml: string | undefined,
	data: Record<string, unknown>,
	// The locale this copy is in: names the built-in shell's language, and is
	// reported as the version sent.
	locale?: string,
): IRenderedTemplate {
	const subject = frag.subject ? render(frag.subject, data) : undefined;
	return {
		text: render(frag.text, data),
		...(subject ? { subject } : {}),
		...(frag.html ? { html: composeHtml(frag.html, layoutHtml, subject, data, locale) } : {}),
		...(locale ? { locale } : {}),
	};
}

// The module-shipped default templates an app hands courier, merged into one
// lookup (aggregated like getMigrationsPath()). Per-key app overrides — a DB row
// or an FS file — always win over a default; the default wins over the
// last-resort JSON dump. A later map wins on key collision.
export class DefaultTemplates {
	private readonly map = new Map<string, IDefaultTemplate>();
	constructor(maps: DefaultTemplateMap[] = []) {
		for (const m of maps) {
			for (const [key, tmpl] of Object.entries(m)) this.map.set(key, tmpl);
		}
	}
	get(type: string): IDefaultTemplate | undefined {
		return this.map.get(type);
	}
	/**
	 * The built-in copy of `type` in `locale`: its exact key, else its language
	 * ('fr-CA' → 'fr'). Built-in copy has no market-specific terms, so the
	 * language is safe here where it would not be for an app's own versions.
	 * Returns the matched key with it — that is the version reported as sent.
	 */
	getLocalized(type: string, locale: string): { copy: IDefaultTemplateCopy; locale: string } | undefined {
		const all = this.map.get(type)?.locales;
		if (!all) return undefined;
		for (const key of [locale, localeLanguage(locale)]) {
			const copy = all[key];
			if (copy) return { copy, locale: key };
		}
		return undefined;
	}
	/** Every language a built-in email ships in besides English. */
	languages(type: string): string[] {
		return Object.keys(this.map.get(type)?.locales ?? {});
	}
	get size(): number {
		return this.map.size;
	}
	/** Every type a module ships a default for. */
	types(): string[] {
		return [...this.map.keys()];
	}
}

// DB-backed resolver. First match wins, for a user in fr-FR whose app declares
// fr-FR → fr-CA:
//
//   1 saved fr-FR, 2 saved fr-CA   the app's versions, along the declared chain
//   3 built-in French              Fonderie's copy, matched by language
//   4 saved default                the system locale's version (untagged row)
//   5 built-in English
//
// The system locale comes LAST on purpose: every built-in email also has a
// saved default row, so trying it before step 3 would send a French user the
// app's English instead of the French that ships. An app's versions never fall
// to a sibling market on their own — only along a chain it declared.
export class DBTemplateResolver implements ITemplateResolver {
	private locales: ILocaleSettings = defineLocales();

	constructor(
		private store: IStoreAdapter,
		private defaults?: DefaultTemplates,
	) {}

	/** The app's locales, handed over at install (core owns them). */
	setLocales(settings: ILocaleSettings): void {
		this.locales = settings;
	}

	async resolve(
		type: string,
		data: Record<string, unknown>,
		locale?: string,
	): Promise<IRenderedTemplate> {
		const chain = localeChain(locale, this.locales);
		const row = await pickRow(this.store, type, chain);
		const system = this.locales.default;
		const def = this.defaults?.get(type);

		if (row?.locale) return this.renderWith(row, data, row.locale);
		if (def) {
			for (const tag of chain) {
				const shipped = this.defaults?.getLocalized(type, tag);
				if (shipped) return this.renderWith(shipped.copy, data, shipped.locale);
			}
		}
		if (row) return this.renderWith(row, data, system);
		// No app row → the module default (rendered identically), then the JSON
		// dump — only reached for a type neither the app nor any module provides.
		if (def) return this.renderWith(def, data, system);
		return { text: `${type}: ${JSON.stringify(data)}` };
	}

	private async renderWith(
		frag: { subject?: string | null; text: string; html?: string | null },
		data: Record<string, unknown>,
		sent: string,
	): Promise<IRenderedTemplate> {
		const layoutHtml = frag.html
			? await getLayoutHtml(this.store, sent === this.locales.default ? undefined : sent, this.locales)
			: undefined;
		return renderFragment(frag, layoutHtml, data, sent);
	}
}

interface IStoredCopy {
	locale: string | null;
	subject: string | null;
	html: string | null;
	text: string;
}

// The first active row along `chain`, else the untagged default row, in one
// query. Tags compare case-insensitively: rows saved before canonicalization
// may say 'fr-ca'. Returns the row with its canonical tag (null = default).
async function pickRow(store: IStoreAdapter, type: string, chain: string[]): Promise<IStoredCopy | undefined> {
	const rows = await store.query<IStoredCopy>(
		`SELECT locale, subject, html, text
		 FROM fonderie_courier_templates
		 WHERE type = $1 AND active = true AND (locale IS NULL OR lower(locale) = ANY($2::text[]))`,
		[type, chain.map((t) => t.toLowerCase())],
	);
	for (const tag of chain) {
		const hit = rows.find((r) => r.locale != null && canonicalLocale(r.locale) === tag);
		if (hit) return { ...hit, locale: tag };
	}
	const base = rows.find((r) => r.locale == null);
	return base ? { ...base, locale: null } : undefined;
}

// The operator's shell for this locale — the first saved _layout along its
// chain, else the untagged one — or undefined to mean "the built-in shell",
// which the renderer then draws in the email's language.
//
// Exported because the admin preview has to reach it: rendering a fragment
// without the shell produces an email that looks nothing like the one that
// sends, and a preview that lies is worse than no preview. One definition
// rather than a second copy of the query living in the route file.
export async function getLayoutHtml(
	store: IStoreAdapter,
	locale?: string,
	settings: ILocaleSettings = defineLocales(),
): Promise<string | undefined> {
	const row = await pickRow(store, LAYOUT_TYPE, localeChain(locale, settings));
	return row?.html ?? undefined;
}

// Filesystem resolver — {type}.{locale}.txt|.html|.subject.txt, then {type}.*,
// with the same order as the DB resolver. A locale's files are one version: if
// any of them exists that locale is used, and a part it lacks is NOT borrowed
// from another locale — mixing a French body with the default subject is how
// half-translated mail goes out.
export class FSTemplateResolver implements ITemplateResolver {
	private locales: ILocaleSettings = defineLocales();

	constructor(
		private directory: string,
		private defaults?: DefaultTemplates,
	) {}

	setLocales(settings: ILocaleSettings): void {
		this.locales = settings;
	}

	async resolve(
		type: string,
		data: Record<string, unknown>,
		locale?: string,
	): Promise<IRenderedTemplate> {
		const { readFile } = await import('node:fs/promises');
		const { join } = await import('node:path');

		const readOptional = async (path: string): Promise<string | null> => {
			try {
				return await readFile(path, 'utf8');
			} catch {
				return null;
			}
		};
		const readSet = async (prefix: string) => {
			const [text, html, subject] = await Promise.all([
				readOptional(join(this.directory, `${prefix}.txt`)),
				readOptional(join(this.directory, `${prefix}.html`)),
				readOptional(join(this.directory, `${prefix}.subject.txt`)),
			]);
			// Presence (=== null), not truthiness: an app that ships even an empty
			// file keeps control of that version, mirroring the DB's row check.
			return text === null && html === null && subject === null ? null : { text, html, subject };
		};
		const layoutFor = async (sent: string): Promise<string | undefined> => {
			const tags = sent === this.locales.default ? [] : localeChain(sent, this.locales);
			for (const tag of tags) {
				const v = await readOptional(join(this.directory, `${LAYOUT_TYPE}.${tag}.html`));
				if (v !== null) return v;
			}
			return (await readOptional(join(this.directory, `${LAYOUT_TYPE}.html`))) ?? undefined;
		};
		const system = this.locales.default;
		const chain = localeChain(locale, this.locales);

		let files: Awaited<ReturnType<typeof readSet>> = null;
		let sent = system;
		for (const tag of chain) {
			files = await readSet(`${type}.${tag}`);
			if (files) {
				sent = tag;
				break;
			}
		}
		if (!files) {
			for (const tag of chain) {
				const shipped = this.defaults?.getLocalized(type, tag);
				if (shipped) {
					const layout = shipped.copy.html ? await layoutFor(shipped.locale) : undefined;
					return renderFragment(shipped.copy, layout, data, shipped.locale);
				}
			}
			files = await readSet(type);
		}

		// App shipped NOTHING for this type → the module default, in the app's own
		// _layout shell if it ships one, then the JSON dump.
		if (!files) {
			const def = this.defaults?.get(type);
			if (def) return renderFragment(def, def.html ? await layoutFor(system) : undefined, data, system);
			return { text: `${type}: ${JSON.stringify(data)}` };
		}

		const { text, html, subject } = files;
		const renderedSubject = subject ? render(subject, data) : undefined;
		const layout = html ? await layoutFor(sent) : undefined;
		return {
			text: text ? render(text, data) : `${type}: ${JSON.stringify(data)}`,
			...(renderedSubject ? { subject: renderedSubject } : {}),
			...(html ? { html: composeHtml(html, layout, renderedSubject, data, sent) } : {}),
			locale: sent,
		};
	}
}
