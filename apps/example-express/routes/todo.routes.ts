import { Router }             from 'express';
import { requireAuth }        from '@fonderie-js/adapter-express';
import type { IStoreAdapter } from '@fonderie-js/store';
import { TodoModel }          from '../models/todo.model';
import { todoController }     from '../controllers/todo.controller';

export function buildTodoRouter(store: IStoreAdapter): Router {
	const router     = Router()
	const controller = todoController(TodoModel(store))

	router.get   ('/v1/todos',     requireAuth, controller.list)
	router.post  ('/v1/todos',     requireAuth, controller.create)
	router.patch ('/v1/todos/:id', requireAuth, controller.complete)
	router.delete('/v1/todos/:id', requireAuth, controller.remove)

	return router
}
