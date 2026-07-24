import type { IStoreAdapter } from '@fonderie/store';

import type { ITemplateResolver, IRenderedTemplate } from '../types';
import { wrapLayout } from './layout';

// The stored template id for a founder-supplied layout shell (DB row `type` or
// FS file `_layout.html`). Absent → the built-in DEFAULT_EMAIL_LAYOUT is used.
const LAYOUT_TYPE = '_layout';

function render(template: string, data: Record<string, unknown>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
		const value = data[key];
		return value !== undefined && value !== null ? String(value) : '';
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
	return render(wrapped, { subject: subject ?? '', preheader: '', ...data });
}

// DB-backed resolver — reads from fonderie_courier_templates with locale fallback
export class DBTemplateResolver implements ITemplateResolver {
	constructor(private store: IStoreAdapter) {}

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
			return { text: `${type}: ${JSON.stringify(data)}` };
		}

		const subject = row.subject ? render(row.subject, data) : undefined;
		const layoutHtml = row.html ? await this.layout(locale) : undefined;

		return {
			text: render(row.text, data),
			...(subject ? { subject } : {}),
			...(row.html ? { html: composeHtml(row.html, layoutHtml, subject, data) } : {}),
		};
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
	constructor(private directory: string) {}

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

		const renderedSubject = subject ? render(subject, data) : undefined;

		return {
			text: text ? render(text, data) : `${type}: ${JSON.stringify(data)}`,
			...(renderedSubject ? { subject: renderedSubject } : {}),
			...(html ? { html: composeHtml(html, layout ?? undefined, renderedSubject, data) } : {}),
		};
	}
}
