// The event catalog — which events a CLIENT may receive, declared by the brick
// that emits them (`describeEvents()` on its module). Read by realtime delivery
// (docs/REALTIME-DESIGN.md) and, later, the webhooks event picker.
//
// Default deny: an event with no entry is never delivered to a client. That is
// the whole safety model — `fonderie.notification.send` carries PINs and reset
// tokens, and it simply has no entry.
import type { IFonderieContext } from './types';

/** Who an event is about, resolved from its payload. */
export interface IEventScope {
	workspaceId?: string;
	userId?: string;
}

/**
 * Who may receive an event:
 *   'public'     every connection, signed in or not (app-wide, e.g. config changed)
 *   'workspace'  active members of the event's workspace
 *   'user'       that user's own connections
 *   a function   the app's own rule (roles, permissions) — how finer audiences
 *                are expressed without core knowing workspaces or permissions
 */
export type EventAudience =
	| 'public'
	| 'workspace'
	| 'user'
	| ((ctx: IFonderieContext, scope: IEventScope) => boolean | Promise<boolean>);

export interface IEventCatalogEntry<P = unknown> {
	/** The event type, e.g. 'fonderie.customer.created'. */
	type: string;
	/** One line for developers and the topics listing. */
	description: string;
	audience: EventAudience;
	/**
	 * Where it comes from. Default: the event bus. `{ notify }` names a Postgres
	 * NOTIFY channel the brick already signals on (its payload is the event's).
	 */
	source?: { notify: string };
	/** The scope, from the payload. Required for 'workspace' and 'user' audiences. */
	scope?: (payload: P) => IEventScope;
	/**
	 * What the client receives. Invalidation only: ids and scope, never domain
	 * data — the client re-reads through its normal API. Default: {}.
	 */
	project?: (payload: P) => Record<string, unknown>;
}

export interface IEventCatalogEntryWithModule extends IEventCatalogEntry {
	module: string;
}

const EVENT_TYPE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const CHANNEL = /^[a-z_][a-z0-9_]*$/;

/** Problems with one entry, as strings; [] when valid. */
export function validateEventCatalogEntry(entry: IEventCatalogEntry, module: string): string[] {
	const at = `${module}: event '${entry?.type ?? '?'}'`;
	const out: string[] = [];
	if (typeof entry?.type !== 'string' || !EVENT_TYPE.test(entry.type)) {
		out.push(`${at}: type must be dotted lowercase (e.g. 'fonderie.customer.created')`);
	}
	if (typeof entry?.description !== 'string' || entry.description.trim().length < 8) {
		out.push(`${at}: description is required`);
	}
	const a = entry?.audience;
	if (!(a === 'public' || a === 'workspace' || a === 'user' || typeof a === 'function')) {
		out.push(`${at}: audience must be 'public', 'workspace', 'user' or a function`);
	}
	if ((a === 'workspace' || a === 'user') && typeof entry.scope !== 'function') {
		out.push(`${at}: a '${a}' audience needs scope(payload) to know whose event it is`);
	}
	if (entry?.source && !CHANNEL.test(entry.source.notify ?? '')) {
		out.push(`${at}: source.notify must be a Postgres channel name`);
	}
	return out;
}

/**
 * Merge every module's entries. Throws on an invalid entry, or on one type
 * declared by two modules — two bricks disagreeing about who may see an event
 * is a bug to fix, not something to pick a winner for.
 */
export function mergeEventCatalogs(
	modules: Array<{ name: string; entries: IEventCatalogEntry[] }>,
): IEventCatalogEntryWithModule[] {
	const problems: string[] = [];
	const byType = new Map<string, IEventCatalogEntryWithModule>();
	for (const { name, entries } of modules) {
		for (const entry of entries) {
			problems.push(...validateEventCatalogEntry(entry, name));
			const prior = byType.get(entry.type);
			if (prior) problems.push(`event '${entry.type}' is declared by both ${prior.module} and ${name}`);
			else byType.set(entry.type, { ...entry, module: name });
		}
	}
	if (problems.length) throw new Error(`[fonderie] invalid event catalog:\n  ${problems.join('\n  ')}`);
	return [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * A client's topic filter: '*' (everything it may receive), an exact type, or
 * a segment prefix ending in '.*' ('fonderie.customer.*'). Matched literally —
 * nothing in a client string is interpreted as a pattern beyond that suffix.
 */
export function matchesTopic(filter: string, type: string): boolean {
	if (filter === '*') return true;
	if (filter.endsWith('.*')) return type.startsWith(filter.slice(0, -1)) && type.length > filter.length - 1;
	return filter === type;
}

/** A filter is well-formed when it is '*', an exact type, or 'prefix.*'. */
export function isValidTopicFilter(filter: string): boolean {
	if (filter === '*') return true;
	const base = filter.endsWith('.*') ? filter.slice(0, -2) : filter;
	return /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/.test(base);
}
