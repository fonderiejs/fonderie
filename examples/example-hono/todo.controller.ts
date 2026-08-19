import type { Context } from 'hono';

import type { TodoModel } from './todo.model.js';

export function todoController(model: ReturnType<typeof TodoModel>) {
	return {
		async list(c: Context) {
			const { user } = c.get('_fonderie')
			return c.json({ todos: await model.list(user!.id) })
		},

		async create(c: Context) {
			const { user } = c.get('_fonderie')
			const { text } = await c.req.json<{ text: string }>()
			return c.json(await model.create(user!.id, text), 201)
		},

		async complete(c: Context) {
			const { user } = c.get('_fonderie')
			const todo = await model.complete(c.req.param('id')!, user!.id)
			if (!todo) return c.json({ error: 'NOT_FOUND' }, 404)
			return c.json(todo)
		},

		async remove(c: Context) {
			const { user } = c.get('_fonderie')
			const deleted = await model.remove(c.req.param('id')!, user!.id)
			if (!deleted) return c.json({ error: 'NOT_FOUND' }, 404)
			return new Response(null, { status: 204 })
		},
	}
}
