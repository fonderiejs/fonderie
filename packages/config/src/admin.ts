import type { IFonderieContext, Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
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
// The admin surface is only registered when a token is configured, so a missing
// config here is defensive.
function checkAdmin(ctx: IFonderieContext, adminToken: string): Response | null {
	const header = ctx.request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : '';
	if (!token || token !== adminToken) {
		return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Missing or invalid admin token');
	}
	return null;
}

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
): { environment?: string; description?: string; ifVersion?: number; actor: string } {
	const opts: { environment?: string; description?: string; ifVersion?: number; actor: string } = {
		actor: actorOf(ctx),
	};
	const env = (b['environment'] as string | undefined) ?? envOf(ctx);
	if (env !== undefined) opts.environment = env;
	if (typeof b['description'] === 'string') opts.description = b['description'];
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

// Wrap a handler in the admin-token guard.
function guarded(adminToken: string, handler: Middleware): Middleware {
	return async (ctx, next) => {
		const denied = checkAdmin(ctx, adminToken);
		return denied ?? handler(ctx, next);
	};
}

// Build the admin route table. Registered by ConfigModule.install only when an
// adminToken is configured.
export function buildAdminRoutes(
	store: IStoreAdapter,
	adminToken: string,
	encryptor: ISecretEncryptor = noopEncryptor,
): Array<[string, string, Middleware]> {
	const g = (h: Middleware): Middleware => guarded(adminToken, h);

	return [
		// ── config ──────────────────────────────────────────────────
		['GET', '/admin/config', g(async (ctx) => {
			const rows = await listConfigEntries(envOf(ctx) ?? null, store);
			return setApiResponse(HTTP.OK, 'CONFIG_LISTED', 'Config entries', rows);
		})],
		['GET', '/admin/config/:key', g(async (ctx) => {
			const row = await getConfigEntry(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return row
				? setApiResponse(HTTP.OK, 'CONFIG_ENTRY', 'Config entry', row)
				: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such config entry');
		})],
		['PUT', '/admin/config/:key', g(async (ctx) => {
			const b = body(ctx);
			if (!('value' in b)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.value is required');
			}
			try {
				const row = await setConfigEntry(
					{ key: keyOf(ctx), value: b['value'], ...writeOpts(ctx, b) },
					store,
				);
				return setApiResponse(HTTP.OK, 'CONFIG_SET', 'Config entry saved', row);
			} catch (err) {
				return conflictOr(err);
			}
		})],
		['DELETE', '/admin/config/:key', g(async (ctx) => {
			const ok = await deleteConfigEntry(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such config entry');
		})],
		['GET', '/admin/config/:key/revisions', g(async (ctx) => {
			const revs = await listConfigRevisions(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(HTTP.OK, 'REVISIONS', 'Config revisions', revs);
		})],
		['POST', '/admin/config/:key/rollback', g(async (ctx) => {
			const b = body(ctx);
			const toVersion = Number(b['toVersion']);
			if (!Number.isInteger(toVersion)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required');
			}
			const row = await rollbackConfigEntry(
				rollbackOpts(ctx, b, toVersion),
				store,
			);
			return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, row);
		})],

		// ── secrets (masked) ────────────────────────────────────────
		['GET', '/admin/secrets', g(async (ctx) => {
			const rows = await listSecrets(envOf(ctx) ?? null, store);
			return setApiResponse(HTTP.OK, 'SECRETS_LISTED', 'Secrets (masked)', rows);
		})],
		['GET', '/admin/secrets/:key', g(async (ctx) => {
			const row = await getSecret(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return row
				? setApiResponse(HTTP.OK, 'SECRET', 'Secret (masked)', row)
				: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such secret');
		})],
		['PUT', '/admin/secrets/:key', g(async (ctx) => {
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
		})],
		['DELETE', '/admin/secrets/:key', g(async (ctx) => {
			const ok = await deleteSecret(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such secret');
		})],
		['GET', '/admin/secrets/:key/revisions', g(async (ctx) => {
			const revs = await listSecretRevisions(keyOf(ctx), envOf(ctx) ?? 'all', store);
			return setApiResponse(HTTP.OK, 'REVISIONS', 'Secret revisions', revs);
		})],
		['POST', '/admin/secrets/:key/rollback', g(async (ctx) => {
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
		})],
		// The one plaintext path — behind the same token; POST so the value never
		// lands in a URL/log. Returns the decrypted value.
		['POST', '/admin/secrets/:key/reveal', g(async (ctx) => {
			const value = await revealSecret(keyOf(ctx), envOf(ctx) ?? 'all', store, encryptor);
			return value === null
				? setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such secret')
				: setApiResponse(HTTP.OK, 'SECRET_REVEALED', 'Decrypted secret value', { value });
		})],
	];
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
