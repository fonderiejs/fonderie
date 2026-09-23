import type { IStoreAdapter } from '@fonderie/store';

import type { ITemplateResolver, IRenderedTemplate, IDefaultTemplate, DefaultTemplateMap } from '../types';
import { EMAIL_THEME, wrapLayout } from './layout';

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
// LeadEasyGen has never heard of Fonderie, so an email headed "Fonderie" reads
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
): string {
	const wrapped = wrapLayout(bodyHtml, layoutHtml);
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
): IRenderedTemplate {
	const subject = frag.subject ? render(frag.subject, data) : undefined;
	return {
		text: render(frag.text, data),
		...(subject ? { subject } : {}),
		...(frag.html ? { html: composeHtml(frag.html, layoutHtml, subject, data) } : {}),
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
	get size(): number {
		return this.map.size;
	}
}

// DB-backed resolver — reads from fonderie_courier_templates with locale fallback
export class DBTemplateResolver implements ITemplateResolver {
	constructor(
		private store: IStoreAdapter,
		private defaults?: DefaultTemplates,
	) {}

	async resolve(
		type: string,
		data: Record<string, unknown>,
		locale?: string,
	): Promise<IRenderedTemplate> {
		const [row] = await this.store.query<{
			subject: string | null;
			html: string | null;
			text: string;
		}>(
			// Serve the exact locale, else the neutral NULL default — never a
			// sibling region (en-CA must not fall back to en-US); the WHERE
			// excludes other locales so legal/jurisdictional copy can't bleed.
			`SELECT subject, html, text
			 FROM fonderie_courier_templates
			 WHERE type = $1 AND active = true AND (locale = $2 OR locale IS NULL)
			 ORDER BY (locale IS NOT DISTINCT FROM $2) DESC
			 LIMIT 1`,
			[type, locale ?? null],
		);

		if (!row) {
			// No app row → fall back to the module default (rendered identically),
			// then to the JSON dump — now only reached for a type neither the app
			// nor any module provides.
			const def = this.defaults?.get(type);
			if (def) {
				return renderFragment(def, def.html ? await this.layout(locale) : undefined, data);
			}
			return { text: `${type}: ${JSON.stringify(data)}` };
		}

		const layoutHtml = row.html ? await this.layout(locale) : undefined;
		return renderFragment(row, layoutHtml, data);
	}

	// Optional founder-supplied layout shell; undefined → built-in default.
	private async layout(locale?: string): Promise<string | undefined> {
		return getLayoutHtml(this.store, locale);
	}
}

// The operator's shell for this locale, or undefined to mean "the built-in
// one" — wrapLayout's default parameter handles that, so callers never pick
// the fallback themselves.
//
// Exported because the admin preview has to reach it: rendering a fragment
// without the shell produces an email that looks nothing like the one that
// sends, and a preview that lies is worse than no preview. One definition
// rather than a second copy of the query living in the route file.
export async function getLayoutHtml(
	store: IStoreAdapter,
	locale?: string,
): Promise<string | undefined> {
	const [row] = await store.query<{ html: string | null }>(
		`SELECT html
		 FROM fonderie_courier_templates
		 WHERE type = $1 AND active = true AND (locale = $2 OR locale IS NULL)
		 ORDER BY (locale IS NOT DISTINCT FROM $2) DESC
		 LIMIT 1`,
		[LAYOUT_TYPE, locale ?? null],
	);
	return row?.html ?? undefined;
}

// Filesystem resolver — reads {type}.{locale}.txt → {type}.txt with fallback
export class FSTemplateResolver implements ITemplateResolver {
	constructor(
		private directory: string,
		private defaults?: DefaultTemplates,
	) {}

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

		// Per-locale variants take priority over generic variants
		const localePrefix = locale ? `${type}.${locale}` : null;
		const layoutPrefix = locale ? `${LAYOUT_TYPE}.${locale}` : null;

		const [text, html, subject, layout] = await Promise.all([
			localePrefix
				? readOptional(join(this.directory, `${localePrefix}.txt`)).then(
						(v) => v ?? readOptional(join(this.directory, `${type}.txt`)),
					)
				: readOptional(join(this.directory, `${type}.txt`)),

			localePrefix
				? readOptional(join(this.directory, `${localePrefix}.html`)).then(
						(v) => v ?? readOptional(join(this.directory, `${type}.html`)),
					)
				: readOptional(join(this.directory, `${type}.html`)),

			localePrefix
				? readOptional(join(this.directory, `${localePrefix}.subject.txt`)).then(
						(v) => v ?? readOptional(join(this.directory, `${type}.subject.txt`)),
					)
				: readOptional(join(this.directory, `${type}.subject.txt`)),

			layoutPrefix
				? readOptional(join(this.directory, `${layoutPrefix}.html`)).then(
						(v) => v ?? readOptional(join(this.directory, `${LAYOUT_TYPE}.html`)),
					)
				: readOptional(join(this.directory, `${LAYOUT_TYPE}.html`)),
		]);

		// App shipped NOTHING for this type (no text/html/subject file) → fall back
		// to the module default, using the app's own _layout shell if it ships one,
		// then to the JSON dump. Test file PRESENCE (=== null), not truthiness, so an
		// app that ships even an empty file keeps per-key control below — mirroring
		// the DB resolver's row-presence check, not overriding it with a default.
		if (text === null && html === null && subject === null) {
			const def = this.defaults?.get(type);
			if (def) {
				return renderFragment(def, def.html ? (layout ?? undefined) : undefined, data);
			}
			return { text: `${type}: ${JSON.stringify(data)}` };
		}

		const renderedSubject = subject ? render(subject, data) : undefined;

		return {
			text: text ? render(text, data) : `${type}: ${JSON.stringify(data)}`,
			...(renderedSubject ? { subject: renderedSubject } : {}),
			...(html ? { html: composeHtml(html, layout ?? undefined, renderedSubject, data) } : {}),
		};
	}
}
