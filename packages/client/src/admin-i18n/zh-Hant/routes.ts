import type en from '../en/routes';

const routes: typeof en = {
	title: '路由',
	lead: '所有公開的路由及其防護。',
	leadCount: '此部署公開了 {n} 個路由，並列出每個路由前的防護。',
	filterPlaceholder: '依路徑、方法、模組篩選…',
	filterLabel: '篩選路由',
	colMethod: '方法',
	colPath: '路徑',
	colGuard: '防護',
	colModule: '模組',
	application: '應用程式',
	noMatch: '沒有符合「{q}」的路由。',
};
export default routes;
