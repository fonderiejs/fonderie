import type en from '../en/log';

const log: typeof en = {
	title: '管理日志',
	lead: '通过此后台发出的每个请求，按时间倒序排列——包括被拒绝的请求。',
	off: '管理日志已关闭——请为 AdminModule 提供一个存储。',
	empty: '暂无请求',
	colWhen: '时间',
	colActor: '操作者',
	colRequest: '请求',
	colStatus: '状态',
	colModule: '模块',
};
export default log;
