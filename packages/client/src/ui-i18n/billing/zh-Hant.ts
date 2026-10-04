import type en from './en';

const billing: typeof en = {
	pricing: {
		loading: '正在載入方案…',
		monthly: '月繳',
		yearly: '年繳',
		perMonth: '/月',
		perYear: '/年',
		choose: '選擇 {plan}',
		redirecting: '正在前往…',
	},
	subscription: {
		loading: '正在載入訂閱…',
		none: '您目前沒有有效的訂閱。',
		viewPlans: '查看方案',
		title: '您的訂閱',
		statusLine: '狀態：{status}',
		statusLineCanceling: '狀態：{status}（將於本期結束時取消）',
		renews: '續訂日期：{date}',
		ends: '到期日期：{date}',
		manage: '管理帳單',
		opening: '正在開啟…',
	},
	paymentMethod: {
		title: '付款方式',
		loading: '正在載入付款方式…',
		link: 'Link',
		linkWithEmail: 'Link · {email}',
		card: '{brand} •••• {last4} · 有效期限 {month}/{year}',
		none: '尚未儲存信用卡。',
		add: '新增信用卡',
		update: '更換信用卡',
		remove: '移除',
		removing: '正在移除…',
	},
	status: {
		active: '有效',
		trialing: '試用中',
		past_due: '逾期未繳',
		unpaid: '未付款',
		canceled: '已取消',
		incomplete: '未完成',
		incomplete_expired: '未完成（已過期）',
		paused: '已暫停',
	},
};

export default billing;
