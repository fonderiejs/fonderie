import express            from 'express';

import { bridge, mount }   from '@fonderie-js/adapter-express';
import { fonderie, store } from './fonderie';
import { buildTodoRouter } from './todo.routes';

const app = express()

app.use(bridge(fonderie))
app.use(buildTodoRouter(store))

mount(app, fonderie)

app.listen(4001, () =>
	console.log('\n  ƒ TodoApp (Express)  http://localhost:4001\n')
)
