import type en from '../en/attention';

const attention: typeof en = {
	title: '待辦事項',
	lead: '此部署中需要您處理的事項',
	leadChecked: '此部署中需要您處理的事項 · 檢查於 {time}',
	needsAction: '需要處理',
	needsActionHint: '待修正的錯誤',
	advice: '建議',
	adviceHint: '值得一看',
	modulesReady: '就緒模組',
	modulesReadyHint: 'admin {version}',
	routes: '路由',
	running: '正在執行檢查…',
	emptyTitle: '沒有需要您處理的事項',
	emptyBody: '所有檢查皆通過。檢查於 {time}。',
};
export default attention;
