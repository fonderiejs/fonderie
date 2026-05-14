import Koa        from 'koa';
import bodyParser from 'koa-bodyparser';

import { mount }           from '@fonderie-js/adapter-koa';
import { fonderie, store } from './fonderie';
import { buildTodoRouter } from './todo.routes';

const app = new Koa()
app.use(bodyParser())

mount(app, fonderie)

const todos = buildTodoRouter(store)
app.use(todos.routes())
app.use(todos.allowedMethods())

app.listen(4002, () =>
	console.log('\n  ƒ TodoApp (Koa)  http://localhost:4002\n')
)
