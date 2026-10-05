import type en from '../en/tokens';

const tokens: typeof en = {
	title: '令牌',
	lead: '供机器使用的凭据：根令牌的强度、用于 CLI 和 CI 的限定权限令牌，以及任何旧版的按模块令牌。人员以管理员身份登录。',
	needsRoot: '签发和撤销需要根令牌（即部署配置中的令牌）。',
	rootToken: '根令牌',
	strong: '强',
	weak: '弱',
	issuedTokens: '已签发的令牌',
	issuingOff: '签发功能已关闭——请为 AdminModule 提供一个存储并运行其迁移。',
	copyNow: '请立即复制——它不会再次显示。',
	namePlaceholder: '名称',
	nameLabel: '名称',
	scope: {
		read: '读取',
		write: '写入',
		secrets: '密钥',
	},
	daysPlaceholder: '天数（可选）',
	daysLabel: '天数',
	issue: '签发令牌',
	col: {
		name: '名称',
		scopes: '权限范围',
		created: '创建时间',
		expires: '过期时间',
		lastUsed: '上次使用',
	},
	revoked: '已撤销',
	revoke: '撤销',
	revokeConfirm: '要撤销“{name}”吗？所有使用它的地方将立即停止工作。',
	emptyTitle: '暂无限定权限令牌',
	emptyBody: '为仪表盘或团队成员签发只读令牌，而不是共享根令牌。',
	legacyTitle: '旧版按模块令牌',
	legacyNone: '无——所有模块的管理接口都通过此令牌访问。',
	legacyRow: '仍使用其自有令牌注册独立路由（已弃用）',
};
export default tokens;
