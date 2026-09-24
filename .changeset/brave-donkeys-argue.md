---
'@fonderie/admin': minor
'@fonderie/client': minor
'@fonderie/react-admin': minor
'@fonderie/vue-admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
---

Apply pending migrations from the admin panel, per module, additive only

The surface could already say a module was behind — the `app.migrations` check
has reported it on the doctor and attention pages since the panel shipped. It
could not do anything about it: applying meant `npm run migrate` from somebody's
laptop, which is exactly the production DDL-by-hand this surface exists to
replace.

`GET /_admin/migrations` now reports every module's pending files **with their
impact**, and `POST /_admin/migrations/:module/apply` applies one — all of its
pending migrations, or none.

**It refuses anything that deletes data.** `classifyMigration` labels each
pending file; a module holding a `DROP`, `TRUNCATE` or `ALTER COLUMN … TYPE` is
not appliable here and the panel names the offending statement and says to use
CI or `npm run migrate` instead. There is no override — dropping a column should
not be one click behind an admin token.

**It refuses out of order.** Migration order is the app's, declared in one
constant, and sets depend on each other across it — auth owns `fonderie_users`,
which app migrations extend. A module sitting behind an unapplied one reports
`blockedBy` and says which to apply first, so the operator walks the declared
order and the UI cannot construct an out-of-order apply.

**It refuses a set that changed under you.** The request carries the pending
filenames the operator was shown; if a deploy has since changed them, the server
answers 409 rather than applying something nobody reviewed.

**It never reports an outcome it did not re-read.** Each migration commits in
its own transaction, so a request that dies partway really did apply some files.
The handler re-reads after `run()`, and the hooks refresh after a failure as
well as a success — a timeout and a refusal must not look alike.

A first install is exempt from the destructive rule: with no
`fonderie_migrations` rows there is nothing to lose, the same judgement the CLI's
`migrate --check` makes.

Opt in by passing your migration sequence: `new AdminModule({ …, migrations:
MIGRATION_STEPS })`. Without it the routes are not registered — this surface
must never infer an order the app owns.
