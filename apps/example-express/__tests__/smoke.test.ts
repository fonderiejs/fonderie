import { test } from 'node:test';
import assert   from 'node:assert/strict';

import type { IStoreAdapter }  from '@fonderie-js/store';
import type { Request, Response } from 'express';
import type { ExpressRequest } from '@fonderie-js/adapter-express';

import { TodoModel }        from '../models/todo.model';
import { todoController }   from '../controllers/todo.controller';
import { buildTodoRouter }  from '../routes/todo.routes';

// ── Stubs ─────────────────────────────────────────────────────────

function makeStore(rows: unknown[] = []): IStoreAdapter {
	return {
		query: async () => rows as any,
		transaction: async (fn) => fn(makeStore(rows)),
	}
}

function makeReq(userId: string, body: unknown = {}, params: Record<string, string> = {}): Request {
	return {
		params,
		body,
		_fonderie: { user: { id: userId }, workspace: null, meta: {} },
	} as unknown as Request
}

function makeRes() {
	const res = {
		statusCode: 200,
		body: undefined as unknown,
		headers: {} as Record<string, string>,
		status(code: number) { this.statusCode = code; return this },
		json(data: unknown) { this.body = data; return this },
		send() { return this },
	}
	return res
}

// ── TodoModel ─────────────────────────────────────────────────────

test('TodoModel.list: queries todos for the given userId', async () => {
	const rows = [{ id: '1', text: 'Buy milk', done: false }]
	const store = makeStore(rows)
	const model = TodoModel(store)

	const result = await model.list('user-1')
	assert.deepEqual(result, rows)
})

test('TodoModel.create: inserts and returns the new todo', async () => {
	const row = { id: 'abc', text: 'Walk dog', done: false }
	const store = makeStore([row])
	const model = TodoModel(store)

	const result = await model.create('user-1', 'Walk dog')
	assert.deepEqual(result, row)
})

test('TodoModel.complete: returns updated todo on success', async () => {
	const row = { id: 'abc', text: 'Walk dog', done: true }
	const store = makeStore([row])
	const model = TodoModel(store)

	const result = await model.complete('abc', 'user-1')
	assert.deepEqual(result, row)
})

test('TodoModel.complete: returns null when todo not found', async () => {
	const model = TodoModel(makeStore([]))
	const result = await model.complete('missing', 'user-1')
	assert.equal(result, null)
})

test('TodoModel.remove: returns true when row deleted', async () => {
	const model = TodoModel(makeStore([{ id: 'abc' }]))
	const result = await model.remove('abc', 'user-1')
	assert.equal(result, true)
})

test('TodoModel.remove: returns false when todo not found', async () => {
	const model = TodoModel(makeStore([]))
	const result = await model.remove('missing', 'user-1')
	assert.equal(result, false)
})

// ── todoController ────────────────────────────────────────────────

test('todoController.list: responds with todos array', async () => {
	const todos = [{ id: '1', text: 'Buy milk', done: false }]
	const model = TodoModel(makeStore(todos))
	const ctrl  = todoController(model)
	const res   = makeRes()

	await ctrl.list(makeReq('user-1'), res as unknown as Response)
	assert.deepEqual(res.body, { todos })
})

test('todoController.create: responds 201 with new todo', async () => {
	const todo  = { id: 'abc', text: 'Walk dog', done: false }
	const model = TodoModel(makeStore([todo]))
	const ctrl  = todoController(model)
	const res   = makeRes()

	await ctrl.create(makeReq('user-1', { text: 'Walk dog' }), res as unknown as Response)
	assert.equal(res.statusCode, 201)
	assert.deepEqual(res.body, todo)
})

test('todoController.complete: responds with updated todo', async () => {
	const todo  = { id: 'abc', text: 'Walk dog', done: true }
	const model = TodoModel(makeStore([todo]))
	const ctrl  = todoController(model)
	const res   = makeRes()

	await ctrl.complete(makeReq('user-1', {}, { id: 'abc' }), res as unknown as Response)
	assert.deepEqual(res.body, todo)
})

test('todoController.complete: responds 404 when not found', async () => {
	const model = TodoModel(makeStore([]))
	const ctrl  = todoController(model)
	const res   = makeRes()

	await ctrl.complete(makeReq('user-1', {}, { id: 'missing' }), res as unknown as Response)
	assert.equal(res.statusCode, 404)
	assert.deepEqual(res.body, { error: 'NOT_FOUND' })
})

test('todoController.remove: responds 204 when deleted', async () => {
	const model = TodoModel(makeStore([{ id: 'abc' }]))
	const ctrl  = todoController(model)
	const res   = makeRes()

	await ctrl.remove(makeReq('user-1', {}, { id: 'abc' }), res as unknown as Response)
	assert.equal(res.statusCode, 204)
})

test('todoController.remove: responds 404 when not found', async () => {
	const model = TodoModel(makeStore([]))
	const ctrl  = todoController(model)
	const res   = makeRes()

	await ctrl.remove(makeReq('user-1', {}, { id: 'missing' }), res as unknown as Response)
	assert.equal(res.statusCode, 404)
	assert.deepEqual(res.body, { error: 'NOT_FOUND' })
})

// ── buildTodoRouter ───────────────────────────────────────────────

test('buildTodoRouter: returns an Express Router with todo routes', () => {
	const router = buildTodoRouter(makeStore())
	assert.ok(typeof router === 'function', 'router should be a function (Express Router)')
})
