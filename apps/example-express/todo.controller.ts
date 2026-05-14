import type { Request, Response } from 'express';
import type { ExpressRequest }    from '@fonderie-js/adapter-express';

import type { TodoModel }         from './todo.model';

export function todoController(model: ReturnType<typeof TodoModel>) {
	return {
		async list(req: Request, res: Response) {
			const { user } = (req as ExpressRequest)._fonderie!
			res.json({ todos: await model.list(user!.id) })
		},

		async create(req: Request, res: Response) {
			const { user } = (req as ExpressRequest)._fonderie!
			const { text } = req.body as { text: string }
			res.status(201).json(await model.create(user!.id, text))
		},

		async complete(req: Request, res: Response) {
			const { user } = (req as ExpressRequest)._fonderie!
			const todo = await model.complete(req.params['id']!, user!.id)
			if (!todo) { res.status(404).json({ error: 'NOT_FOUND' }); return }
			res.json(todo)
		},

		async remove(req: Request, res: Response) {
			const { user } = (req as ExpressRequest)._fonderie!
			const deleted = await model.remove(req.params['id']!, user!.id)
			if (!deleted) { res.status(404).json({ error: 'NOT_FOUND' }); return }
			res.status(204).send()
		},
	}
}
