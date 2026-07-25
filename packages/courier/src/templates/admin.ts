import type { IStoreAdapter, IVersionedResource } from '@fonderie/store';
import { versionedWrite, versionedRollback } from '@fonderie/store';

// Versioned management for email templates, on the shared `@fonderie/store`
// primitive. Templates are keyed by (type, locale) — a NULL locale is the base,
// with per-locale overrides on top — and their content is subject/html/text.
// The resolver reads the current row unchanged; this adds edit + history +
// rollback + optimistic concurrency on top.

export interface ITemplateEntry {
	type: string;
	locale: string | null;
	subject: string | null;
	html: string | null;
	text: string;
	active: boolean;
	version: number;
	updatedBy: string | null;
	updatedAt: string;
}

export interface ITemplateRevision {
	type: string;
	locale: string | null;
	subject: string | null;
	html: string | null;
	text: string;
	version: number;
	actor: string | null;
	createdAt: string;
}

const ENTRY_COLS = `type, locale, subject, html, text, active, version, updated_by AS "updatedBy", updated_at AS "updatedAt"`;

const TEMPLATE_RESOURCE: IVersionedResource = {
	table: 'fonderie_courier_templates',
	revisions: 'fonderie_courier_template_revisions',
	channel: 'fonderie_courier_templates_changed',
	keyColumns: ['type', 'locale'],
	contentColumns: ['subject', 'html', 'text'],
	metaColumns: ['active'],
	returning: ENTRY_COLS,
};

// Upsert a template (full body — a revision is a full snapshot). Pass `ifVersion`
// for optimistic concurrency (else `VersionConflictError`). `locale` omitted /
// null targets the base template.
export async function setTemplate(
	opts: {
		type: string;
		text: string;
		locale?: string | null;
		subject?: string | null;
		html?: string | null;
		active?: boolean;
		ifVersion?: number;
		actor?: string;
	},
	store: IStoreAdapter,
): Promise<ITemplateEntry> {
	const data: Record<string, unknown> = {
		subject: opts.subject ?? null,
		html: opts.html ?? null,
		text: opts.text,
	};
	if (opts.active !== undefined) data['active'] = opts.active;
	return versionedWrite<ITemplateEntry>(TEMPLATE_RESOURCE, store, {
		key: opts.type,
		scope: opts.locale ?? null,
		data,
		...(opts.ifVersion !== undefined ? { ifVersion: opts.ifVersion } : {}),
		actor: opts.actor ?? null,
	});
}

export async function rollbackTemplate(
	opts: { type: string; locale?: string | null; toVersion: number; actor?: string },
	store: IStoreAdapter,
): Promise<ITemplateEntry> {
	return versionedRollback<ITemplateEntry>(TEMPLATE_RESOURCE, store, {
		key: opts.type,
		scope: opts.locale ?? null,
		toVersion: opts.toVersion,
		actor: opts.actor ?? null,
	});
}

export async function listTemplateRevisions(
	type: string,
	locale: string | null,
	store: IStoreAdapter,
): Promise<ITemplateRevision[]> {
	return store.query<ITemplateRevision>(
		`SELECT type, locale, subject, html, text, version, actor, created_at AS "createdAt"
		 FROM fonderie_courier_template_revisions
		 WHERE type = $1 AND locale IS NOT DISTINCT FROM $2
		 ORDER BY version DESC`,
		[type, locale],
	);
}

export async function getTemplateEntry(
	type: string,
	locale: string | null,
	store: IStoreAdapter,
): Promise<ITemplateEntry | null> {
	const [row] = await store.query<ITemplateEntry>(
		`SELECT ${ENTRY_COLS} FROM fonderie_courier_templates WHERE type = $1 AND locale IS NOT DISTINCT FROM $2`,
		[type, locale],
	);
	return row ?? null;
}

export async function listTemplateEntries(store: IStoreAdapter): Promise<ITemplateEntry[]> {
	return store.query<ITemplateEntry>(
		`SELECT ${ENTRY_COLS} FROM fonderie_courier_templates ORDER BY type, locale NULLS FIRST`,
	);
}
