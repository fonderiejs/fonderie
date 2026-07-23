import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter, MigrationRunner, InternalMigrationRunner } from '@fonderie/store';
import { EventsModule } from '@fonderie/events';
import { getMigrationsPath as evtMig } from '@fonderie/events/migrations';
import { AuthModule } from '@fonderie/auth';
import { getMigrationsPath as authMig } from '@fonderie/auth/migrations';
import { BillingModule, StripeProvider } from '@fonderie/billing';
import { getMigrationsPath as billMig } from '@fonderie/billing/migrations';
import { WorkspacesModule } from '@fonderie/workspaces';
import { getMigrationsPath as wsMig } from '@fonderie/workspaces/migrations';

const config = defineConfig({ db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/cf' } });
export const store = new PGAdapter(config.db.url);

for (const dir of [evtMig(), authMig(), billMig(), wsMig()]) {
  await new InternalMigrationRunner(store, dir).run();
}

const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } });
const auth = new AuthModule(store, {
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here-xx',
  appName: 'CrewFinding',
  providers: ['email'],
  requireVerification: false,
}, events.bus);
// workspaces requires billing (workspace.plan) — a mandatory chain even for a
// field-service app that never sells subscriptions. Provider is lazy (only hit
// on billing endpoints, which this contract test never calls).
const billing = new BillingModule(store, {
  provider: new StripeProvider('sk_test_dummy_for_contract_boot'),
  plans: [],
  successUrl: 'http://localhost/success',
  cancelUrl: 'http://localhost/cancel',
});
const workspaces = new WorkspacesModule(store, {}, events.bus);

export { config };
export const fonderie = new FonderieApp(config)
  .register(events).register(auth).register(billing).register(workspaces);
await fonderie.boot();
