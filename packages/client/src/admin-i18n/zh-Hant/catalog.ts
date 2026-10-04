import type en from '../en/catalog';

const catalog: typeof en = {
	title: '方案目錄',
	lead: '您販售的內容：程式碼中設定的方案與資料庫中儲存的方案，並排比較。',
	configured: '已設定（程式碼）',
	stored: '已儲存（資料庫）',
	emptyTitle: '沒有已儲存的方案',
	emptyBody: '方案已在程式碼中設定；尚未寫入任何內容到資料庫。',
	col: {
		plan: '方案',
		tier: '等級',
		seats: '席位',
		monthly: '月繳',
		yearly: '年繳',
		trial: '試用',
	},
	trialDays: '{n} 天',
	deleteConfirm: '要刪除已儲存的方案「{name}」嗎？',
};
export default catalog;
