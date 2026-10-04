import type en from '../en/environment';

const environment: typeof en = {
	title: '環境',
	lead: '各模組是否已設定，以及應用程式讀取的每個變數是否已設定。數值永不顯示。',
	missingCount: '缺少 {n} 個',
	allSet: '全部已設定',
	variables: '變數',
	noVariables: '未宣告任何變數，請將 `env` 傳給 AdminModule。',
	moduleReadiness: '模組就緒狀態',
	problemOne: '1 個問題',
	problemMany: '{n} 個問題',
};
export default environment;
