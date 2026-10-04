import type en from '../en/audit';

const audit: typeof en = {
	title: '稽核',
	lead: '發生過的事件，除非您指定工作區，否則涵蓋所有工作區。事件鏈的完整性判定位於「健康檢查」頁面。',
	workspacePlaceholder: '工作區 ID（留空表示全部）',
	typePlaceholder: '事件類型',
	actorPlaceholder: '操作者 ID',
	fromLabel: '開始日期',
	fromTitle: '開始（含當日）',
	toLabel: '結束日期',
	toTitle: '結束（含當日）',
	empty: '此篩選條件下沒有任何記錄',
	col: {
		when: '時間',
		type: '類型',
		workspace: '工作區',
		actor: '操作者',
		request: '請求',
	},
};
export default audit;
