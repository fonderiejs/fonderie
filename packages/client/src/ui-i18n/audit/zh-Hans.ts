import type en from './en';

// Mainland Simplified Chinese UI wording.
const audit: typeof en = {
	log: {
		title: '审计日志',
		eventType: '事件类型',
		actorId: '操作者 ID',
		filter: '筛选',
		loading: '加载中…',
		loadMore: '加载更多',
		system: '系统',
		a11y: {
			eventType: '事件类型筛选',
			eventTypeHint: '仅显示此类型的事件',
			actorId: '操作者 ID 筛选',
			actorIdHint: '仅显示此操作者的事件',
			filter: '应用筛选',
			event: '{type}，操作者 {actor}，{date}',
			eventHint: '显示或隐藏事件详情',
			loadMore: '加载更多事件',
			loadingMore: '正在加载更多事件',
		},
	},
};

export default audit;
