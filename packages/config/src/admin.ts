import type { IAdminRoute, IFonderieContext, Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import { requireAdminToken } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';

import type { ISecretEncryptor } from './crypto';
import { noopEncryptor } from './crypto';
import {
	listConfigEntries,
	getConfigEntry,
	setConfigEntry,
	deleteConfigEntry,
	rollbackConfigEntry,
	listConfigRevisions,
	withParsedValue,
	ConfigConflictError,
} from './services/config';
import {
	listSecrets,
	getSecret,
	revealSecret,
	setSecret,
	deleteSecret,
	rollbackSecret,
	listSecretRevisions,
} from './services/secrets';

// Bootstrap-token guard. Returns null when authorized, else the 401/503 Response.

// The actor recorded on writes/audit — an optional `X-Actor` header lets the
// caller (or the LLM) identify who; defaults to a generic admin label.
function actorOf(ctx: IFonderieContext): string {
	return ctx.request.headers.get('x-actor') || 'admin-token';
}

function envOf(ctx: IFonderieContext): string | undefined {
	return new URL(ctx.request.url).searchParams.get('environment') ?? undefined;
}

function keyOf(ctx: IFonderieContext): string {
	return ctx.meta.params?.['key'] ?? '';
}

function body(ctx: IFonderieContext): Record<string, unknown> {
	return (ctx.meta['body'] as Record<string, unknown> | undefined) ?? {};
}

// Build the shared optional write fields, omitting any that aren't present
// (exactOptionalPropertyTypes: never assign `undefined`).
function writeOpts(
	ctx: IFonderieContext,
	b: Record<string, unknown>,
): { environment?: string; description?: string; active?: boolean; ifVersion?: number; actor: string } {
	const opts: {
		environment?: string;
		description?: string;
		active?: boolean;
		ifVersion?: number;
		actor: string;
	} = {
		actor: actorOf(ctx),
	};
	const env = (b['environment'] as string | undefined) ?? envOf(ctx);
	if (env !== undefined) opts.environment = env;
	if (typeof b['description'] === 'string') opts.description = b['description'];
	// Previously dropped here, silently forcing active=true on every HTTP
	// write while list reads filter on it.
	if (typeof b['active'] === 'boolean') opts.active = b['active'];
	if (typeof b['ifVersion'] === 'number') opts.ifVersion = b['ifVersion'] as number;
	return opts;
}

// Rollback opts, omitting `environment` when not supplied.
function rollbackOpts(
	ctx: IFonderieContext,
	b: Record<string, unknown>,
	toVersion: number,
): { key: string; environment?: string; toVersion: number; actor: string } {
	const opts: { key: string; environment?: string; toVersion: number; actor: string } = {
		key: keyOf(ctx),
		toVersion,
		actor: actorOf(ctx),
	};
	const env = (b['environment'] as string | undefined) ?? envOf(ctx);
	if (env !== undefined) opts.environment = env;
	return opts;
}

// Wrap a handler in the shared admin-token guard (@fonderie/core/middlewares) —
// one constant-time Bearer check across billing/config/courier.
function guarded(adminToken: string, handler: Middleware): Middleware {
	const guard = requireAdminToken(adminToken);
	return (ctx, next) => guard(ctx, () => handler(ctx, next));
}

type RouteRow = [string, string, Middleware];

// The legacy standalone surface (bare /admin/*, guarded by this module's own
// token). Registered by ConfigModule.install only when an adminToken is configured.
export function buildAdminRoutes(
	store: IStoreAdapter,
	adminToken: string,
	encryptor?: ISecretEncryptor,
): RouteRow[] {
	return adminRouteTable(store, encryptor).map(([m, p, h]) => [m, p, guarded(adminToken, h)]);
}

// The same handlers, unguarded and prefix-relative, for @fonderie/admin to mount
// under its own prefix behind its own token.
export function describeAdminRoutes(
	store: IStoreAdapter,
	encryptor?: ISecretEncryptor,
): IAdminRoute[] {
	return adminRouteTable(store, encryptor).map(([method, path, h]) => ({
		method,
		path: path.replace(/^\/admin/, ''),
		handlers: [h],
	}));
}

// Without an encryptor, every secrets route REFUSES instead of operating on
// plaintext.
//
// The surface used to be served regardless, with `noopEncryptor` standing in —
// so a deployment with no key stored secrets in clear and handed them back over
// `POST /admin/secrets/:key/reveal`. checkReadiness only called that an error
// when this brick had its OWN adminToken, which missed the normal case
// entirely: describeAdmin() is unconditional, so @fonderie/admin mounts these
// under /_admin and reveals them whatever this brick's token says.
//
// It refuses rather than omitting the routes. A missing page is a silent
// signal — the operator sees nothing and learns nothing — whereas a 503 that
// names the cause and the fix is a signal they can act on, and it keeps the
// console's page visible to carry the message.
const SECRETS_DISABLED =
	'secrets are disabled: no secretEncryptor is configured, and storing or revealing ' +
	'them in plaintext is refused. Pass secretEncryptor: createAesGcmEncryptor(key) ' +
	'to ConfigModule (key: `openssl rand -hex 32`).';

const refuseSecrets = async (): Promise<Response> =>
	setApiResponse(HTTP.SERVICE_UNAVAILABLE, 'SECRETS_DISABLED', SECRETS_DISABLED, null);

function adminRouteTable(store: IStoreAdapter, encryptor?: ISecretEncryptor): RouteRow[] {
	const rows: RouteRow[] = [
		// ── config ──────────────────────────────────────────────────
		['GET', '/admin/config', async (ctx) => {
			const rows = await listConfigEntries(envOf(ctx) ?? null, store);
			return setApiResponse(HTTP.OK, 'CONFIG_LISTED', 'Config entries', rows.map(withParsedValue));
		}],
		['GET', '/admin/config/:key', async (ctx) => {
			const row = await getConfigEntry(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return row
				? setApiResponse(HTTP.OK, 'CONFIG_ENTRY', 'Config entry', withParsedValue(row))
				: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such config entry');
		}],
		['PUT', '/admin/config/:key', async (ctx) => {
			const b = body(ctx);
			if (!('value' in b)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.value is required');
			}
			try {
				const row = await setConfigEntry(
					{ key: keyOf(ctx), value: b['value'], ...writeOpts(ctx, b) },
					store,
				);
				return setApiResponse(HTTP.OK, 'CONFIG_SET', 'Config entry saved', withParsedValue(row));
			} catch (err) {
				return conflictOr(err);
			}
		}],
		['DELETE', '/admin/config/:key', async (ctx) => {
			const ok = await deleteConfigEntry(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such config entry');
		}],
		['GET', '/admin/config/:key/revisions', async (ctx) => {
			const revs = await listConfigRevisions(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(HTTP.OK, 'REVISIONS', 'Config revisions', revs.map(withParsedValue));
		}],
		['POST', '/admin/config/:key/rollback', async (ctx) => {
			const b = body(ctx);
			const toVersion = Number(b['toVersion']);
			if (!Number.isInteger(toVersion)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required');
			}
			const row = await rollbackConfigEntry(
				rollbackOpts(ctx, b, toVersion),
				store,
			);
			return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, withParsedValue(row));
		}],

		// ── secrets (masked) ────────────────────────────────────────
	];

	// Config rows always work — they hold no secret material. The secrets
	// rows are added either way so the route table (and therefore the
	// console's page) does not change shape based on configuration; only the
	// handler differs.
	const secretRows: RouteRow[] = [
		['GET', '/admin/secrets', async (ctx) => {
			const rows = await listSecrets(envOf(ctx) ?? null, store);
			return setApiResponse(HTTP.OK, 'SECRETS_LISTED', 'Secrets (masked)', rows);
		}],
		['GET', '/admin/secrets/:key', async (ctx) => {
			const row = await getSecret(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return row
				? setApiResponse(HTTP.OK, 'SECRET', 'Secret (masked)', row)
				: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such secret');
		}],
		['PUT', '/admin/secrets/:key', async (ctx) => {
			const b = body(ctx);
			if (typeof b['value'] !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.value (string) is required');
			}
			try {
				const row = await setSecret(
					{ key: keyOf(ctx), value: b['value'], ...writeOpts(ctx, b) },
					store,
					encryptor,
				);
				return setApiResponse(HTTP.OK, 'SECRET_SET', 'Secret saved (masked)', row);
			} catch (err) {
				return conflictOr(err);
			}
		}],
		['DELETE', '/admin/secrets/:key', async (ctx) => {
			const ok = await deleteSecret(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such secret');
		}],
		['GET', '/admin/secrets/:key/revisions', async (ctx) => {
			const revs = await listSecretRevisions(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(HTTP.OK, 'REVISIONS', 'Secret revisions', revs);
		}],
		['POST', '/admin/secrets/:key/rollback', async (ctx) => {
			const b = body(ctx);
			const toVersion = Number(b['toVersion']);
			if (!Number.isInteger(toVersion)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required');
			}
			const row = await rollbackSecret(
				rollbackOpts(ctx, b, toVersion),
				store,
			);
			return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, row);
		}],
		// The one plaintext path — behind the same token; POST so the value never
		// lands in a URL/log. Returns the decrypted value.
		['POST', '/admin/secrets/:key/reveal', async (ctx) => {
			const value = await revealSecret(keyOf(ctx), envOf(ctx) ?? 'all', store, encryptor);
			return value === null
				? setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such secret')
				: setApiResponse(HTTP.OK, 'SECRET_REVEALED', 'Decrypted secret value', { value });
		}],
	];

	rows.push(
		...(encryptor
			? secretRows
			: secretRows.map(([m, path]) => [m, path, refuseSecrets] as RouteRow)),
	);

	return rows;
}

// Map a lost optimistic-concurrency write to a 409 (reject-and-retry), else rethrow.
function conflictOr(err: unknown): Response {
	if (err instanceof ConfigConflictError) {
		return setApiResponse(HTTP.CONFLICT, 'VERSION_CONFLICT', err.message, {
			currentVersion: err.currentVersion,
		});
	}
	throw err;
}
