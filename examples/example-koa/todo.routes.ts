import Router               from '@koa/router';
import type { IStoreAdapter } from '@fonderie/store';
import { requireAuth }      from '@fonderie/adapter-koa';

import { TodoModel }        from './todo.model.js';
import { todoController }   from './todo.controller.js';

export function buildTodoRouter(store: IStoreAdapter, prefix = '') {
	const router     = new Router({ prefix })
	const controller = todoController(TodoModel(store))

	router.get   ('/todos',      requireAuth, controller.list)
	router.post  ('/todos',      requireAuth, controller.create)
	router.patch ('/todos/:id',  requireAuth, controller.complete)
	router.delete('/todos/:id',  requireAuth, controller.remove)

	return router
}
