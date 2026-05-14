import Koa        from 'koa';
import bodyParser from 'koa-bodyparser';

import { bridge, mount }       from '@fonderie-js/adapter-koa';

import { fonderie, store }     from './config/fonderie';
import { buildTodoRouter }     from './routes/todo.routes';

const app = new Koa()

app.use(bodyParser())
app.use(bridge(fonderie))

const todos = buildTodoRouter(store)
app.use(todos.routes())
app.use(todos.allowedMethods())

mount(app, fonderie)

app.listen(4002, () =>
	console.log('\n  ƒ TodoApp (Koa)  http://localhost:4002\n')
)
