import { Hono }             from 'hono';
import type { IStoreAdapter } from '@fonderie/store';
import { requireAuth }      from '@fonderie/adapter-hono';

import { TodoModel }        from './todo.model.js';
import { todoController }   from './todo.controller.js';

export function buildTodoRouter(store: IStoreAdapter): Hono {
	const router = new Hono()
	const ctrl   = todoController(TodoModel(store))

	router.get   ('/todos',     requireAuth, (c) => ctrl.list(c))
	router.post  ('/todos',     requireAuth, (c) => ctrl.create(c))
	router.patch ('/todos/:id', requireAuth, (c) => ctrl.complete(c))
	router.delete('/todos/:id', requireAuth, (c) => ctrl.remove(c))

	return router
}
