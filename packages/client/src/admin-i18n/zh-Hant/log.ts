import type en from '../en/log';

const log: typeof en = {
	title: '管理記錄',
	lead: '透過此介面發出的所有請求（包括被拒絕的請求），最新的在前。',
	off: '管理記錄已關閉，請為 AdminModule 提供儲存區。',
	empty: '尚無請求',
	colWhen: '時間',
	colActor: '操作者',
	colRequest: '請求',
	colStatus: '狀態',
	colModule: '模組',
};
export default log;
