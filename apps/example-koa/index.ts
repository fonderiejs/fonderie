import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import Koa        from 'koa';
import Router     from '@koa/router';
import bodyParser from 'koa-bodyparser';
import type Koa_  from 'koa';

import { FonderieApp, defineConfig }                          from '@fonderie-js/core';
import { withBody }                                           from '@fonderie-js/core/middlewares';
import { PGAdapter, MigrationRunner, InternalMigrationRunner } from '@fonderie-js/store';
import { EventsModule }                                       from '@fonderie-js/events';
import { AuthModule }                                         from '@fonderie-js/auth';
import { getMigrationsPath as authMig }                       from '@fonderie-js/auth/migrations';
import { getMigrationsPath as evtMig }                        from '@fonderie-js/events/migrations';
import { bridge, requireAuth, mount }                         from '@fonderie-js/adapter-koa';
import type { IFonderieContext }                              from '@fonderie-js/core';

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// State type — extends default Koa state with fonderie context
type State = Koa_.DefaultState & { _fonderie: IFonderieContext }
type Ctx   = Koa_.ParameterizedContext<State>

// ── Config ────────────────────────────────────────────────────────

const config = defineConfig({
	basePath: '/v1',
	db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_koa' },
})

// ── Store + migrations ────────────────────────────────────────────

const store = new PGAdapter(config.db.url)

for (const dir of [evtMig(), authMig()]) {
	await new InternalMigrationRunner(store, dir).run()
}

await new MigrationRunner(store, join(__dirname, 'migrations/sql')).run()

// ── Fonderie modules ──────────────────────────────────────────────

const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } })
const auth   = new AuthModule(store, {
	jwtSecret:           process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
	appName:             'TodoApp',
	providers:           ['email'],
	requireVerification: false,
}, events.bus)

const fonderie = new FonderieApp(config)
	.use(withBody)
	.register(events)
	.register(auth)

await fonderie.boot()

// ── Koa app ───────────────────────────────────────────────────────
//
// bridge()      — runs fonderie's global middleware (session verification,
//                 billing…) and populates ctx.state._fonderie with
//                 { user, workspace, meta }. Requires koa-bodyparser first.
//
// requireAuth   — fonderie guard, pre-adapted as native Koa middleware.
//                 Import from @fonderie-js/adapter-koa, not from core.
//
// mount()       — registers fonderie's infrastructure routes as a catch-all.
//                 Always call LAST so your own routes take priority.

const app    = new Koa<State>()
const router = new Router<State>()

app.use(bodyParser())      // populates ctx.request.body + ctx.request.rawBody
app.use(bridge(fonderie))  // populates ctx.state._fonderie

// ── Todos ─────────────────────────────────────────────────────────

type TodoRow = { id: string; text: string; done: boolean; user_id: string }

router.get('/v1/todos', requireAuth, async (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	const todos = await store.query<TodoRow>(
		'SELECT id, text, done FROM todos WHERE user_id = $1 ORDER BY created_at',
		[user!.id],
	)
	ctx.body = { todos }
})

router.post('/v1/todos', requireAuth, async (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	const { text } = ctx.request.body as { text: string }
	const [todo] = await store.query<TodoRow>(
		'INSERT INTO todos (id, user_id, text) VALUES (gen_random_uuid(), $1, $2) RETURNING id, text, done',
		[user!.id, text],
	)
	ctx.status = 201
	ctx.body   = todo
})

router.patch('/v1/todos/:id', requireAuth, async (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	const [todo] = await store.query<TodoRow>(
		'UPDATE todos SET done = true WHERE id = $1 AND user_id = $2 RETURNING id, text, done',
		[ctx.params['id'], user!.id],
	)
	if (!todo) { ctx.status = 404; ctx.body = { error: 'NOT_FOUND' }; return }
	ctx.body = todo
})

router.delete('/v1/todos/:id', requireAuth, async (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	const [deleted] = await store.query<{ id: string }>(
		'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id',
		[ctx.params['id'], user!.id],
	)
	if (!deleted) { ctx.status = 404; ctx.body = { error: 'NOT_FOUND' }; return }
	ctx.status = 204
})

app.use(router.routes())
app.use(router.allowedMethods())

// ── Fonderie infrastructure (mounted last) ────────────────────────
//
// POST  /v1/auth/register           { email, password }
// POST  /v1/auth/login              { email, password }
// POST  /v1/auth/logout
// POST  /v1/auth/refresh
//
// POST  /v1/auth/email/forgot       { email }
// POST  /v1/auth/email/reset        { token, password }
//
// GET   /v1/auth/send-verification  (auth required)
// POST  /v1/auth/verify             { code }          (auth required)
//
// GET   /v1/users                   (auth required)
// PUT   /v1/users/profile           (auth required)
// PUT   /v1/users/email             (auth required)
// DELETE /v1/users                  (auth required)

mount(app, fonderie)

app.listen(4002, () =>
	console.log('\n  ƒ TodoApp (Koa)  http://localhost:4002\n')
)
