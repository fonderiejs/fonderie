import express from 'express';

import { FonderieApp, defineConfig }                          from '@fonderie-js/core';
import { withBody }                                           from '@fonderie-js/core/middlewares';
import { PGAdapter, InternalMigrationRunner }                  from '@fonderie-js/store';
import { EventsModule }                                       from '@fonderie-js/events';
import { AuthModule }                                         from '@fonderie-js/auth';
import { getMigrationsPath as authMig }                       from '@fonderie-js/auth/migrations';
import { getMigrationsPath as evtMig }                        from '@fonderie-js/events/migrations';
import { bridge, requireAuth, mount }                         from '@fonderie-js/adapter-express';
import type { ExpressRequest }                                from '@fonderie-js/adapter-express';

// ── Config ────────────────────────────────────────────────────────

const config = defineConfig({
	basePath: '/v1',
	db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_express' },
})

// ── Store + migrations ────────────────────────────────────────────

const store = new PGAdapter(config.db.url)

for (const dir of [evtMig(), authMig()]) {
	await new InternalMigrationRunner(store, dir).run()
}

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

// ── Express app ───────────────────────────────────────────────────
//
// bridge()      — runs fonderie's global middleware (session verification,
//                 billing…) and populates req._fonderie with { user, workspace,
//                 meta }. Also forwards the parsed body to req.body.
//
// requireAuth   — fonderie guard, pre-adapted as native Express middleware.
//                 Import from @fonderie-js/adapter-express, not from core.
//
// mount()       — registers fonderie's infrastructure routes as a catch-all.
//                 Always call LAST so your own routes take priority.

const app = express()

app.use(bridge(fonderie))

// ── Todos (in-memory) ─────────────────────────────────────────────

const todos: { id: string; text: string; done: boolean; userId: string }[] = []

app.get('/v1/todos', requireAuth, (req, res) => {
	const { user } = (req as ExpressRequest)._fonderie!
	res.json({ todos: todos.filter(t => t.userId === user!.id) })
})

app.post('/v1/todos', requireAuth, (req, res) => {
	const { user } = (req as ExpressRequest)._fonderie!
	const { text } = req.body as { text: string }
	const todo = { id: crypto.randomUUID(), text, done: false, userId: user!.id }
	todos.push(todo)
	res.status(201).json(todo)
})

app.patch('/v1/todos/:id', requireAuth, (req, res) => {
	const { user } = (req as ExpressRequest)._fonderie!
	const todo = todos.find(t => t.id === req.params['id'] && t.userId === user!.id)
	if (!todo) { res.status(404).json({ error: 'NOT_FOUND' }); return }
	todo.done = true
	res.json(todo)
})

app.delete('/v1/todos/:id', requireAuth, (req, res) => {
	const { user } = (req as ExpressRequest)._fonderie!
	const idx = todos.findIndex(t => t.id === req.params['id'] && t.userId === user!.id)
	if (idx === -1) { res.status(404).json({ error: 'NOT_FOUND' }); return }
	todos.splice(idx, 1)
	res.status(204).send()
})

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

app.listen(4001, () =>
	console.log('\n  ƒ TodoApp (Express)  http://localhost:4001\n')
)
