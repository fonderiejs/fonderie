import type en from './en';

const billing: typeof en = {
	pricing: {
		loading: '正在加载套餐…',
		monthly: '按月',
		yearly: '按年',
		perMonth: '/月',
		perYear: '/年',
		choose: '选择 {plan}',
		redirecting: '正在跳转…',
	},
	subscription: {
		loading: '正在加载订阅…',
		none: '你目前没有有效的订阅。',
		viewPlans: '查看套餐',
		title: '我的订阅',
		statusLine: '状态：{status}',
		statusLineCanceling: '状态：{status}（将在本期结束时取消）',
		renews: '续订日期：{date}',
		ends: '到期日期：{date}',
		manage: '管理账单',
		opening: '正在打开…',
	},
	paymentMethod: {
		title: '付款方式',
		loading: '正在加载付款方式…',
		link: 'Link',
		linkWithEmail: 'Link · {email}',
		card: '{brand} •••• {last4} · 有效期至 {month}/{year}',
		none: '尚未绑定银行卡。',
		add: '添加银行卡',
		update: '更换银行卡',
		remove: '移除',
		removing: '正在移除…',
	},
	status: {
		active: '有效',
		trialing: '试用中',
		past_due: '逾期未付',
		unpaid: '未付款',
		canceled: '已取消',
		incomplete: '未完成',
		incomplete_expired: '未完成（已过期）',
		paused: '已暂停',
	},
};

export default billing;
