import type en from '../en/environment';

const environment: typeof en = {
	title: '环境',
	lead: '每个模块是否已配置，以及应用读取的每个变量是否已设置。从不显示变量值。',
	missingCount: '缺少 {n} 个',
	allSet: '全部已设置',
	variables: '变量',
	noVariables: '未声明任何变量——请向 AdminModule 传入 `env`。',
	moduleReadiness: '模块就绪状态',
	problemOne: '1 个问题',
	problemMany: '{n} 个问题',
};
export default environment;
