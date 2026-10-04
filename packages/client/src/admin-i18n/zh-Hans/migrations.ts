import type en from '../en/migrations';

const migrations: typeof en = {
	title: '迁移',
	lead: '各模块附带的数据库结构变更，以及此数据库是否已应用。',
	needsWrite: '应用迁移需要具有写入权限范围的令牌。',
	firstInstall: '此数据库从未执行过迁移——将视为首次安装，因此不会保留任何迁移。',
	upToDate: '所有模块均已是最新',
	noPending: '没有待应用的迁移。',
	pendingCount: '{n} 个待应用',
	destructive: '破坏性',
	additive: '增量',
	blockedBy: '请先应用“{module}”——它在此模块之前运行，且尚未更新。',
	destructiveBlocked:
		'包含会删除数据的迁移。没有回滚迁移可以恢复数据——请通过 CI 或 `npm run migrate` 应用此迁移。',
	confirmApply: '要将 {n} 个迁移应用到“{module}”吗？这会更改数据库结构。',
	applyOne: '应用 1 个迁移',
	applyMany: '应用 {n} 个迁移',
};
export default migrations;
