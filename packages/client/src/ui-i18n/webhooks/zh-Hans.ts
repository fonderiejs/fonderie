import type en from './en';

// Mainland Simplified Chinese UI wording.
const webhooks: typeof en = {
	loading: '加载中…',
	enabled: '已启用',
	disabled: '已停用',
	status: {
		pending: '待投递',
		delivered: '已投递',
		failed: '失败',
	},
	list: {
		title: 'Webhook',
		newSecret: '新端点的签名密钥（仅显示一次）：',
		urlPlaceholder: 'https://example.com/webhook',
		eventsPlaceholder: 'event.type, event.other（可选）',
		add: '添加端点',
		test: '测试',
		delete: '删除',
		testOk: '{endpoint}：成功',
		testFailed: '{endpoint}：失败（{reason}）',
		a11y: {
			url: '端点 URL 输入框',
			urlHint: '接收事件的 URL',
			events: '事件类型输入框',
			eventsHint: '以逗号分隔的事件类型；留空则接收所有事件',
			add: '添加端点按钮',
			open: '打开端点 {url}',
			test: '向 {url} 发送测试事件',
			delete: '删除端点 {url}',
		},
	},
	detail: {
		title: 'Webhook 端点',
		url: 'URL',
		events: '事件（以逗号分隔）',
		save: '保存',
		deliveries: '投递记录',
		attemptsOne: '{count} 次尝试',
		attemptsOther: '{count} 次尝试',
		back: '返回 Webhook',
		a11y: {
			url: '端点 URL 输入框',
			events: '事件类型输入框',
			enabled: '端点已启用',
			save: '保存按钮',
		},
	},
};

export default webhooks;
