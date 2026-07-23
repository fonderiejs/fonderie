import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter, MigrationRunner, InternalMigrationRunner } from '@fonderie/store';
import { EventsModule } from '@fonderie/events';
import { getMigrationsPath as evtMig } from '@fonderie/events/migrations';
import { AuthModule } from '@fonderie/auth';
import { getMigrationsPath as authMig } from '@fonderie/auth/migrations';
import { WorkspacesModule } from '@fonderie/workspaces';
import { getMigrationsPath as wsMig } from '@fonderie/workspaces/migrations';

// Map a Fonderie user object -> crewfinding's flat IUserDTO (avatarUrl<-profileImageUrl,
// locale/timezone lifted from preferences).
function userDTO(u: any) {
  return {
    id: u?.id ?? '', email: u?.email ?? '',
    firstName: u?.firstName ?? '', lastName: u?.lastName ?? '',
    phone: u?.phone ?? '', avatarUrl: u?.profileImageUrl ?? u?.avatarUrl ?? '',
    locale: u?.locale ?? u?.preferences?.locale ?? 'en-US',
    timezone: u?.timezone ?? u?.preferences?.timezone ?? 'UTC',
    isEmailVerified: !!u?.isEmailVerified, mfaEnabled: !!u?.mfaEnabled, suspended: !!u?.suspended,
    createdAt: u?.createdAt ?? '', updatedAt: u?.updatedAt ?? '',
  };
}

// The ONE config option: adapt Fonderie's {reason,explanation,result} envelope to
// crewfinding's flat contract, keyed off the (already alias-rewritten) path.
function onResponse(body: any, { status, request }: { status: number; request: Request }) {
  if (status >= 400) return { error: body?.explanation ?? body?.reason ?? 'error' };
  const path = new URL(request.url).pathname;
  const r = body?.result ?? {};
  if (r && r.tokens) return { user: userDTO(r.user), accessToken: r.tokens.access, refreshToken: r.tokens.refresh };
  if (path === '/users' || path.startsWith('/users/')) return userDTO(r.user ?? r);
  if (path.startsWith('/workspaces')) return { workspace: r };
  if (body && body.reason && body.result === undefined) return { ok: true };
  return r;
}

const config = defineConfig({
  db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/cf' },
  onResponse,
});
export const store = new PGAdapter(config.db.url);

for (const dir of [evtMig(), authMig(), wsMig()]) {
  await new InternalMigrationRunner(store, dir).run();
}

const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } });
const auth = new AuthModule(store, {
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here-xx',
  appName: 'CrewFinding', providers: ['email'], requireVerification: false,
}, events.bus);
const workspaces = new WorkspacesModule(store, {}, events.bus);

export { config };
export const fonderie = new FonderieApp(config)
  .register(events).register(auth).register(workspaces);
await fonderie.boot();
