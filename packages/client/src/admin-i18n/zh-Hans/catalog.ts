import type en from '../en/catalog';

const catalog: typeof en = {
	title: '商品目录',
	lead: '您销售的内容：代码中配置的套餐与数据库中存储的套餐，并排对照。',
	configured: '已配置（代码）',
	stored: '已存储（数据库）',
	emptyTitle: '没有已存储的套餐',
	emptyBody: '套餐在代码中配置；尚未写入数据库。',
	col: {
		plan: '套餐',
		tier: '等级',
		seats: '席位',
		monthly: '月付',
		yearly: '年付',
		trial: '试用',
	},
	trialDays: '{n} 天',
	deleteConfirm: '要删除已存储的套餐“{name}”吗？',
};
export default catalog;
