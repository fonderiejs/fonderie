import type en from '../en/audit';

const audit: typeof en = {
	title: '审计',
	lead: '发生了什么——除非您指定某个工作区，否则涵盖所有工作区。审计链的完整性结论见“诊断”页面。',
	workspacePlaceholder: '工作区 ID（留空表示全部）',
	typePlaceholder: '事件类型',
	actorPlaceholder: '操作者 ID',
	fromLabel: '开始日期',
	fromTitle: '开始（含当天）',
	toLabel: '结束日期',
	toTitle: '结束（含当天）',
	empty: '此筛选条件下没有记录',
	col: {
		when: '时间',
		type: '类型',
		workspace: '工作区',
		actor: '操作者',
		request: '请求',
	},
};
export default audit;
