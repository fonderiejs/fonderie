import type en from '../en/tokens';

const tokens: typeof en = {
	title: '權杖',
	lead: '供機器使用的憑證：根權杖的強度、供 CLI 與 CI 使用的範圍權杖，以及舊版的各模組權杖。人員則以管理員身分登入。',
	needsRoot: '發行與撤銷需要根權杖（即部署設定中的那一個）。',
	rootToken: '根權杖',
	strong: '強',
	weak: '弱',
	issuedTokens: '已發行的權杖',
	issuingOff: '發行功能已關閉，請為 AdminModule 提供儲存區並執行其遷移。',
	copyNow: '請立即複製，此權杖不會再次顯示。',
	namePlaceholder: '名稱',
	nameLabel: '名稱',
	scope: {
		read: '讀取',
		write: '寫入',
		secrets: '機密',
	},
	daysPlaceholder: '天數（選填）',
	daysLabel: '天數',
	issue: '發行權杖',
	col: {
		name: '名稱',
		scopes: '範圍',
		created: '建立時間',
		expires: '到期時間',
		lastUsed: '上次使用',
	},
	revoked: '已撤銷',
	revoke: '撤銷',
	revokeConfirm: '要撤銷「{name}」嗎？所有使用它的項目將立即失效。',
	emptyTitle: '尚無範圍權杖',
	emptyBody: '請為儀表板或團隊成員發行唯讀權杖，而非分享根權杖。',
	legacyTitle: '舊版各模組權杖',
	legacyNone: '無：所有模組的管理介面皆透過此權杖存取。',
	legacyRow: '仍以自己的權杖註冊其獨立路由（已淘汰）',
};
export default tokens;
