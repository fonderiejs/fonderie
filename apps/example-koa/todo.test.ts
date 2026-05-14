import { test } from 'node:test';
import assert   from 'node:assert/strict';

import type { IStoreAdapter }        from '@fonderie-js/store';
import type { IFonderieContext }      from '@fonderie-js/core';
import type { ParameterizedContext }  from 'koa';

import { TodoModel }       from './todo.model';
import { todoController }  from './todo.controller';
import { buildTodoRouter } from './todo.routes';

// ── Stubs ─────────────────────────────────────────────────────────

function makeStore(rows: unknown[] = []): IStoreAdapter {
	return {
		query: async () => rows as any,
		transaction: async (fn) => fn(makeStore(rows)),
	}
}

function makeCtx(
	userId: string,
	body: unknown = {},
	params: Record<string, string> = {},
): ParameterizedContext<{ _fonderie: IFonderieContext }> {
	return {
		params,
		request: { body },
		state: { _fonderie: { user: { id: userId }, workspace: null, meta: {} } },
		status: 200,
		body: undefined,
	} as any
}

// ── TodoModel ─────────────────────────────────────────────────────

test('TodoModel.list: queries todos for the given userId', async () => {
	const rows = [{ id: '1', text: 'Buy milk', done: false }]
	const result = await TodoModel(makeStore(rows)).list('user-1')
	assert.deepEqual(result, rows)
})

test('TodoModel.create: inserts and returns the new todo', async () => {
	const row    = { id: 'abc', text: 'Walk dog', done: false }
	const result = await TodoModel(makeStore([row])).create('user-1', 'Walk dog')
	assert.deepEqual(result, row)
})

test('TodoModel.complete: returns updated todo on success', async () => {
	const row    = { id: 'abc', text: 'Walk dog', done: true }
	const result = await TodoModel(makeStore([row])).complete('abc', 'user-1')
	assert.deepEqual(result, row)
})

test('TodoModel.complete: returns null when todo not found', async () => {
	const result = await TodoModel(makeStore([])).complete('missing', 'user-1')
	assert.equal(result, null)
})

test('TodoModel.remove: returns true when row deleted', async () => {
	const result = await TodoModel(makeStore([{ id: 'abc' }])).remove('abc', 'user-1')
	assert.equal(result, true)
})

test('TodoModel.remove: returns false when todo not found', async () => {
	const result = await TodoModel(makeStore([])).remove('missing', 'user-1')
	assert.equal(result, false)
})

// ── todoController ────────────────────────────────────────────────

test('todoController.list: sets ctx.body with todos array', async () => {
	const todos = [{ id: '1', text: 'Buy milk', done: false }]
	const ctrl  = todoController(TodoModel(makeStore(todos)))
	const ctx   = makeCtx('user-1')

	await ctrl.list(ctx)
	assert.deepEqual(ctx.body, { todos })
})

test('todoController.create: sets status 201 and ctx.body to new todo', async () => {
	const todo = { id: 'abc', text: 'Walk dog', done: false }
	const ctrl = todoController(TodoModel(makeStore([todo])))
	const ctx  = makeCtx('user-1', { text: 'Walk dog' })

	await ctrl.create(ctx)
	assert.equal(ctx.status, 201)
	assert.deepEqual(ctx.body, todo)
})

test('todoController.complete: sets ctx.body to updated todo', async () => {
	const todo = { id: 'abc', text: 'Walk dog', done: true }
	const ctrl = todoController(TodoModel(makeStore([todo])))
	const ctx  = makeCtx('user-1', {}, { id: 'abc' })

	await ctrl.complete(ctx)
	assert.deepEqual(ctx.body, todo)
})

test('todoController.complete: sets 404 when not found', async () => {
	const ctrl = todoController(TodoModel(makeStore([])))
	const ctx  = makeCtx('user-1', {}, { id: 'missing' })

	await ctrl.complete(ctx)
	assert.equal(ctx.status, 404)
	assert.deepEqual(ctx.body, { error: 'NOT_FOUND' })
})

test('todoController.remove: sets 204 when deleted', async () => {
	const ctrl = todoController(TodoModel(makeStore([{ id: 'abc' }])))
	const ctx  = makeCtx('user-1', {}, { id: 'abc' })

	await ctrl.remove(ctx)
	assert.equal(ctx.status, 204)
})

test('todoController.remove: sets 404 when not found', async () => {
	const ctrl = todoController(TodoModel(makeStore([])))
	const ctx  = makeCtx('user-1', {}, { id: 'missing' })

	await ctrl.remove(ctx)
	assert.equal(ctx.status, 404)
	assert.deepEqual(ctx.body, { error: 'NOT_FOUND' })
})

// ── buildTodoRouter ───────────────────────────────────────────────

test('buildTodoRouter: returns a Koa Router with todo routes', () => {
	const router = buildTodoRouter(makeStore())
	assert.ok(typeof router.routes === 'function', 'router should expose a routes() method')
})
