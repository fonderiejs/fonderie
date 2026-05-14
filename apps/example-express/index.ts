import express from 'express';

import { mount }           from '@fonderie-js/adapter-express';
import { fonderie, store } from './fonderie';
import { buildTodoRouter } from './todo.routes';

const app = mount(express(), fonderie)

app.use(buildTodoRouter(store))

app.listen(4001, () =>
	console.log('\n  ƒ TodoApp (Express)  http://localhost:4001\n')
)
