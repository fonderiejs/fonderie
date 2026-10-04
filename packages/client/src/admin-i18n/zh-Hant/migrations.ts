import type en from '../en/migrations';

const migrations: typeof en = {
	title: '遷移',
	lead: '各模組提供的結構描述變更，以及此資料庫是否已套用。',
	needsWrite: '套用遷移需要具有寫入範圍的權杖。',
	firstInstall:
		'此資料庫從未執行過遷移，將視為首次安裝，因此不會保留任何遷移。',
	upToDate: '所有模組皆為最新',
	noPending: '沒有待套用的遷移。',
	pendingCount: '{n} 個待套用',
	destructive: '破壞性',
	additive: '新增性',
	blockedBy: '請先套用「{module}」：它在此模組之前執行，且尚未更新。',
	destructiveBlocked:
		'包含會刪除資料的遷移，沒有任何反向遷移能復原資料。請透過 CI 或 `npm run migrate` 套用此遷移。',
	confirmApply: '要對「{module}」套用 {n} 個遷移嗎？這會變更資料庫結構描述。',
	applyOne: '套用 1 個遷移',
	applyMany: '套用 {n} 個遷移',
};
export default migrations;
