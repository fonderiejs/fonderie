import type en from './en';

// Traditional Chinese for Taiwan / Hong Kong readers (wording, not a
// character conversion of zh-Hans).
const webhooks: typeof en = {
	loading: '載入中…',
	enabled: '已啟用',
	disabled: '已停用',
	status: {
		pending: '等待傳送',
		delivered: '已傳送',
		failed: '失敗',
	},
	list: {
		title: 'Webhook',
		newSecret: '新端點的簽章密鑰（僅顯示一次）：',
		urlPlaceholder: 'https://example.com/webhook',
		eventsPlaceholder: 'event.type, event.other（選填）',
		add: '新增端點',
		test: '測試',
		delete: '刪除',
		testOk: '{endpoint}：成功',
		testFailed: '{endpoint}：失敗（{reason}）',
		a11y: {
			url: '端點 URL 輸入欄',
			urlHint: '接收事件的 URL',
			events: '事件類型輸入欄',
			eventsHint: '以逗號分隔的事件類型；留空即接收所有事件',
			add: '新增端點按鈕',
			open: '開啟端點 {url}',
			test: '傳送測試事件至 {url}',
			delete: '刪除端點 {url}',
		},
	},
	detail: {
		title: 'Webhook 端點',
		url: 'URL',
		events: '事件（以逗號分隔）',
		save: '儲存',
		deliveries: '傳送記錄',
		attemptsOne: '{count} 次嘗試',
		attemptsOther: '{count} 次嘗試',
		back: '返回 Webhook',
		a11y: {
			url: '端點 URL 輸入欄',
			events: '事件類型輸入欄',
			enabled: '端點已啟用',
			save: '儲存按鈕',
		},
	},
};

export default webhooks;
