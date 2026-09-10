import type { IStoreAdapter } from '@fonderie/store';

import type { ITemplateResolver, IRenderedTemplate, IDefaultTemplate, DefaultTemplateMap } from '../types';
import { wrapLayout } from './layout';

// The stored template id for a founder-supplied layout shell (DB row `type` or
// FS file `_layout.html`). Absent → the built-in DEFAULT_EMAIL_LAYOUT is used.
const LAYOUT_TYPE = '_layout';

// HTML-entity-escape interpolated VALUES in html templates. Template markup
// itself is trusted (authored by the app/module); the DATA is not — e.g.
// {{firstName}} is registration-controlled, and unescaped it lets a user
// inject markup/links into platform-branded emails (phishing content with the
// platform's own sender reputation). Text/subject parts stay raw: they are
// not HTML contexts.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function render(
	template: string,
	data: Record<string, unknown>,
	opts: { escapeHtml?: boolean } = {},
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
		const value = data[key];
		if (value === undefined || value === null) return '';
		const s = String(value);
		return opts.escapeHtml ? escapeHtml(s) : s;
	});
}

// Compose a body fragment into its layout shell, then interpolate variables
// over the whole. `subject`/`preheader` become available to the shell's title
// and inbox preview text.
function composeHtml(
	bodyHtml: string,
	layoutHtml: string | undefined,
	subject: string | undefined,
	data: Record<string, unknown>,
): string {
	const wrapped = wrapLayout(bodyHtml, layoutHtml);
	return render(wrapped, { subject: subject ?? '', preheader: '', ...data }, { escapeHtml: true });
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
		const [row] = await this.store.query<{ html: string | null }>(
			`SELECT html
			 FROM fonderie_courier_templates
			 WHERE type = $1 AND active = true AND (locale = $2 OR locale IS NULL)
			 ORDER BY (locale IS NOT DISTINCT FROM $2) DESC
			 LIMIT 1`,
			[LAYOUT_TYPE, locale ?? null],
		);
		return row?.html ?? undefined;
	}
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
