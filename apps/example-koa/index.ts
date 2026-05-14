import type Koa_  from 'koa';
import Koa        from 'koa';
import Router     from '@koa/router';
import bodyParser from 'koa-bodyparser';

import type { IFonderieContext }        from '@fonderie-js/core';
import { FonderieApp, defineConfig }    from '@fonderie-js/core';
import { AuthModule }                   from '@fonderie-js/auth';
import { PGAdapter, MigrationRunner }   from '@fonderie-js/store';
import { EventsModule }                 from '@fonderie-js/events';
import { bridge, adapt, mount }         from '@fonderie-js/adapter-koa';
import { getMigrationsPath as authMig } from '@fonderie-js/auth/migrations';
import { withBody, requireAuth }        from '@fonderie-js/core/middlewares';
import { getMigrationsPath as evtMig }  from '@fonderie-js/events/migrations';

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
	await new MigrationRunner(store, dir).run()
}

// ── Fonderie modules ──────────────────────────────────────────────

const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } })
const auth   = new AuthModule(store, {
	jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
	appName:   'TodoApp',
	providers: ['email'],
}, events.bus)

const fonderie = new FonderieApp(config)
	.use(withBody)
	.register(events)
	.register(auth)

await fonderie.boot()

// ── Koa app ───────────────────────────────────────────────────────
//
// bridge()  — runs fonderie's global middleware (session verification, billing…)
//             and populates ctx.state._fonderie with { user, workspace, meta }.
//             Requires koa-bodyparser to run first so rawBody is available.
//
// adapt()   — wraps any fonderie middleware (requireAuth, withWorkspace…)
//             into a standard Koa middleware function.
//
// mount()   — registers fonderie's infrastructure routes as a catch-all.
//             Always call LAST so your own routes take priority.

const app    = new Koa<State>()
const router = new Router<State>()

app.use(bodyParser())      // populates ctx.request.body + ctx.request.rawBody
app.use(bridge(fonderie))  // populates ctx.state._fonderie

// ── Todos (in-memory) ─────────────────────────────────────────────

const todos: { id: string; text: string; done: boolean; userId: string }[] = []

router.get('/v1/todos', adapt(requireAuth), (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	ctx.body = { todos: todos.filter(t => t.userId === user!.id) }
})

router.post('/v1/todos', adapt(requireAuth), (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	const { text } = ctx.request.body as { text: string }
	const todo = { id: crypto.randomUUID(), text, done: false, userId: user!.id }
	todos.push(todo)
	ctx.status = 201
	ctx.body   = todo
})

router.patch('/v1/todos/:id', adapt(requireAuth), (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	const todo = todos.find(t => t.id === ctx.params['id'] && t.userId === user!.id)
	if (!todo) { ctx.status = 404; ctx.body = { error: 'NOT_FOUND' }; return }
	todo.done = true
	ctx.body  = todo
})

router.delete('/v1/todos/:id', adapt(requireAuth), (ctx: Ctx) => {
	const { user } = ctx.state._fonderie
	const idx = todos.findIndex(t => t.id === ctx.params['id'] && t.userId === user!.id)
	if (idx === -1) { ctx.status = 404; ctx.body = { error: 'NOT_FOUND' }; return }
	todos.splice(idx, 1)
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
