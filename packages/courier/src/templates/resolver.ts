import type { IStoreAdapter } from '@fonderie-js/store';

import type { ITemplateResolver, IRenderedTemplate } from '../types';

function render(template: string, data: Record<string, unknown>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
		const value = data[key];
		return value !== undefined && value !== null ? String(value) : '';
	});
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
			`SELECT subject, html, text
			 FROM fonderie_courier_templates
			 WHERE type = $1 AND active = true
			 ORDER BY (locale = $2)::int DESC, (locale IS NULL)::int DESC
			 LIMIT 1`,
			[type, locale ?? null],
		);

		if (!row) {
			return { text: `${type}: ${JSON.stringify(data)}` };
		}

		return {
			text: render(row.text, data),
			...(row.subject ? { subject: render(row.subject, data) } : {}),
			...(row.html ? { html: render(row.html, data) } : {}),
		};
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

		const [text, html, subject] = await Promise.all([
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
		]);

		return {
			text: text ? render(text, data) : `${type}: ${JSON.stringify(data)}`,
			...(subject ? { subject: render(subject, data) } : {}),
			...(html ? { html: render(html, data) } : {}),
		};
	}
}
