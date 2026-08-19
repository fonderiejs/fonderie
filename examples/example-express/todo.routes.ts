import { Router }             from 'express';
import { requireAuth }        from '@fonderie/adapter-express';
import type { IStoreAdapter } from '@fonderie/store';

import { TodoModel }          from './todo.model.js';
import { todoController }     from './todo.controller.js';

export function buildTodoRouter(store: IStoreAdapter): Router {
	const router     = Router()
	const controller = todoController(TodoModel(store))

	router.get   ('/todos',     requireAuth, controller.list)
	router.post  ('/todos',     requireAuth, controller.create)
	router.patch ('/todos/:id', requireAuth, controller.complete)
	router.delete('/todos/:id', requireAuth, controller.remove)

	return router
}
