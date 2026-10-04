import type en from '../en/routes';

const routes: typeof en = {
	title: '路由',
	lead: '所有公开的路由及其守卫。',
	leadCount: '此部署公开了 {n} 个路由，以及每个路由前的守卫。',
	filterPlaceholder: '按路径、方法、模块筛选…',
	filterLabel: '筛选路由',
	colMethod: '方法',
	colPath: '路径',
	colGuard: '守卫',
	colModule: '模块',
	application: '应用',
	noMatch: '没有与“{q}”匹配的路由。',
};
export default routes;
