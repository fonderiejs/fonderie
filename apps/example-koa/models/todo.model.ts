import type { IStoreAdapter } from '@fonderie-js/store';

export type Todo = { id: string; text: string; done: boolean }

export function TodoModel(store: IStoreAdapter) {
	return {
		list(userId: string): Promise<Todo[]> {
			return store.query<Todo>(
				'SELECT id, text, done FROM todos WHERE user_id = $1 ORDER BY created_at',
				[userId],
			)
		},

		async create(userId: string, text: string): Promise<Todo> {
			const [todo] = await store.query<Todo>(
				'INSERT INTO todos (id, user_id, text) VALUES (gen_random_uuid(), $1, $2) RETURNING id, text, done',
				[userId, text],
			)
			return todo!
		},

		async complete(id: string, userId: string): Promise<Todo | null> {
			const [todo] = await store.query<Todo>(
				'UPDATE todos SET done = true WHERE id = $1 AND user_id = $2 RETURNING id, text, done',
				[id, userId],
			)
			return todo ?? null
		},

		async remove(id: string, userId: string): Promise<boolean> {
			const [row] = await store.query<{ id: string }>(
				'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id',
				[id, userId],
			)
			return row !== undefined
		},
	}
}
