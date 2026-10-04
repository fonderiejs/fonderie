import type en from './en';

// Traditional Chinese for Taiwan / Hong Kong readers (wording, not a
// character conversion of zh-Hans).
const audit: typeof en = {
	log: {
		title: '稽核記錄',
		eventType: '事件類型',
		actorId: '操作者 ID',
		filter: '篩選',
		loading: '載入中…',
		loadMore: '載入更多',
		system: '系統',
		a11y: {
			eventType: '事件類型篩選',
			eventTypeHint: '僅顯示此類型的事件',
			actorId: '操作者 ID 篩選',
			actorIdHint: '僅顯示此操作者的事件',
			filter: '套用篩選',
			event: '{type}，操作者 {actor}，{date}',
			eventHint: '顯示或隱藏事件詳細資料',
			loadMore: '載入更多事件',
			loadingMore: '正在載入更多事件',
		},
	},
};

export default audit;
