import type { IStoreAdapter }                       from '@fonderie-js/store';

import type { ITemplateResolver, IRenderedTemplate } from '../types';

// Simple template engine — replaces {{key}} with data values
function render(template: string, data: Record<string, unknown>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		const value = data[key];
		return value !== undefined && value !== null ? String(value) : '';
	});
}

// DB-backed resolver — reads templates from fonderie_courier_templates
export class DBTemplateResolver implements ITemplateResolver {
	constructor(private store: IStoreAdapter) {}

	async resolve(type: string, data: Record<string, unknown>): Promise<IRenderedTemplate> {
		const [row] = await this.store.query<{
			subject:   string | null
			html:      string | null
			text:      string
		}>(
			`SELECT subject, html, text
			FROM fonderie_courier_templates
			WHERE type = $1 AND active = true
			LIMIT 1`,
			[type],
		);

		if (!row) {
			// Fallback — plain text with data serialized
			return {
				text: `${type}: ${JSON.stringify(data)}`
			}
		}

		return {
			text:    render(row.text, data),
			...(row.subject ? { subject: render(row.subject, data) } : {}),
			...(row.html    ? { html:    render(row.html, data) }    : {}),
		}
	}
}

// Filesystem resolver — reads from .txt / .html files
export class FSTemplateResolver implements ITemplateResolver {
	constructor(private directory: string) {}

	async resolve(type: string, data: Record<string, unknown>): Promise<IRenderedTemplate> {
		const { readFile } = await import('node:fs/promises');
		const { join }     = await import('node:path');

		const readOptional = async (path: string): Promise<string | null> => {
			try {
				return await readFile(path, 'utf8');
			} catch {
				return null;
			}
		}

		const [text, html, subject] = await Promise.all([
			readOptional(join(this.directory, `${type}.txt`)),
			readOptional(join(this.directory, `${type}.html`)),
			readOptional(join(this.directory, `${type}.subject.txt`)),
		]);

		return {
			text:    text    ? render(text, data)    : `${type}: ${JSON.stringify(data)}`,
			...(subject ? { subject: render(subject, data) } : {}),
			...(html    ? { html:    render(html, data) }    : {}),
		}
	}
}
