import Router               from '@koa/router';
import type { IStoreAdapter } from '@fonderie-js/store';
import { requireAuth }      from '@fonderie-js/adapter-koa';

import { TodoModel }        from './todo.model';
import { todoController }   from './todo.controller';

export function buildTodoRouter(store: IStoreAdapter) {
	const router     = new Router()
	const controller = todoController(TodoModel(store))

	router.get   ('/v1/todos',      requireAuth, controller.list)
	router.post  ('/v1/todos',      requireAuth, controller.create)
	router.patch ('/v1/todos/:id',  requireAuth, controller.complete)
	router.delete('/v1/todos/:id',  requireAuth, controller.remove)

	return router
}
