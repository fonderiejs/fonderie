import type en from '../en/attention';

const attention: typeof en = {
	title: '待处理事项',
	lead: '此部署中需要您处理的事项',
	leadChecked: '此部署中需要您处理的事项 · 检查于 {time}',
	needsAction: '需要处理',
	needsActionHint: '待修复的错误',
	advice: '建议',
	adviceHint: '值得一看',
	modulesReady: '就绪模块',
	modulesReadyHint: 'admin {version}',
	routes: '路由',
	running: '正在运行检查…',
	emptyTitle: '暂无需要您处理的事项',
	emptyBody: '所有检查均已通过。检查于 {time}。',
};
export default attention;
