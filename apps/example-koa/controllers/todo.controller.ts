import type { ParameterizedContext } from 'koa';
import type { IFonderieContext }     from '@fonderie-js/core';

import type { TodoModel }            from '../models/todo.model';

type State = { _fonderie: IFonderieContext }
type Ctx   = ParameterizedContext<State>

export function todoController(model: ReturnType<typeof TodoModel>) {
	return {
		async list(ctx: Ctx) {
			const { user } = ctx.state._fonderie
			ctx.body = { todos: await model.list(user!.id) }
		},

		async create(ctx: Ctx) {
			const { user } = ctx.state._fonderie
			const { text } = ctx.request.body as { text: string }
			ctx.status = 201
			ctx.body   = await model.create(user!.id, text)
		},

		async complete(ctx: Ctx) {
			const { user } = ctx.state._fonderie
			const todo = await model.complete(ctx.params['id']!, user!.id)
			if (!todo) { ctx.status = 404; ctx.body = { error: 'NOT_FOUND' }; return }
			ctx.body = todo
		},

		async remove(ctx: Ctx) {
			const { user } = ctx.state._fonderie
			const deleted = await model.remove(ctx.params['id']!, user!.id)
			if (!deleted) { ctx.status = 404; ctx.body = { error: 'NOT_FOUND' }; return }
			ctx.status = 204
		},
	}
}
