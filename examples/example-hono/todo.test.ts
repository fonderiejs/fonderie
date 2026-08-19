import { test } from 'node:test';
import assert   from 'node:assert/strict';
import { Hono } from 'hono';

import type { IStoreAdapter } from '@fonderie/store';
import type { IFonderieContext } from '@fonderie/core';

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

function makeCtx(userId: string, body: unknown = {}, params: Record<string, string> = {}) {
	const fCtx: Partial<IFonderieContext> = { user: { id: userId } as any, workspace: null, meta: {} }
	return {
		get: (key: string) => key === '_fonderie' ? fCtx : undefined,
		req: {
			json:  async () => body,
			param: (name: string) => params[name] ?? '',
		},
		json: (data: unknown, status = 200) => Response.json(data, { status }),
	}
}

// ── TodoModel ─────────────────────────────────────────────────────

test('TodoModel.list: queries todos for the given userId', async () => {
	const rows   = [{ id: '1', text: 'Buy milk', done: false }]
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

test('todoController.list: responds with todos array', async () => {
	const todos = [{ id: '1', text: 'Buy milk', done: false }]
	const ctrl  = todoController(TodoModel(makeStore(todos)))

	const res  = await ctrl.list(makeCtx('user-1') as any)
	const body = await res.json()

	assert.equal(res.status, 200)
	assert.deepEqual(body, { todos })
})

test('todoController.create: responds 201 with new todo', async () => {
	const todo = { id: 'abc', text: 'Walk dog', done: false }
	const ctrl = todoController(TodoModel(makeStore([todo])))

	const res  = await ctrl.create(makeCtx('user-1', { text: 'Walk dog' }) as any)
	const body = await res.json()

	assert.equal(res.status, 201)
	assert.deepEqual(body, todo)
})

test('todoController.complete: responds with updated todo', async () => {
	const todo = { id: 'abc', text: 'Walk dog', done: true }
	const ctrl = todoController(TodoModel(makeStore([todo])))

	const res  = await ctrl.complete(makeCtx('user-1', {}, { id: 'abc' }) as any)
	const body = await res.json()

	assert.equal(res.status, 200)
	assert.deepEqual(body, todo)
})

test('todoController.complete: responds 404 when not found', async () => {
	const ctrl = todoController(TodoModel(makeStore([])))

	const res  = await ctrl.complete(makeCtx('user-1', {}, { id: 'missing' }) as any)
	const body = await res.json()

	assert.equal(res.status, 404)
	assert.deepEqual(body, { error: 'NOT_FOUND' })
})

test('todoController.remove: responds 204 when deleted', async () => {
	const ctrl = todoController(TodoModel(makeStore([{ id: 'abc' }])))

	const res = await ctrl.remove(makeCtx('user-1', {}, { id: 'abc' }) as any)

	assert.equal(res.status, 204)
})

test('todoController.remove: responds 404 when not found', async () => {
	const ctrl = todoController(TodoModel(makeStore([])))

	const res  = await ctrl.remove(makeCtx('user-1', {}, { id: 'missing' }) as any)
	const body = await res.json()

	assert.equal(res.status, 404)
	assert.deepEqual(body, { error: 'NOT_FOUND' })
})

// ── buildTodoRouter ───────────────────────────────────────────────

test('buildTodoRouter: returns a Hono instance with todo routes', () => {
	const router = buildTodoRouter(makeStore())
	assert.ok(router instanceof Hono, 'router should be a Hono instance')
})
