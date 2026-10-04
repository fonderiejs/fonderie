import type en from '../en/operators';

const operators: typeof en = {
	title: '管理员',
	lead: '可以登录此控制台的人员。每人都使用密码和身份验证器应用；不开放注册。',
	level: {
		read: '只读',
		editor: '编辑者',
		owner: '所有者',
	},
	levelHint: {
		read: '可浏览，不可更改',
		editor: '可更改配置、模板、用户',
		owner: '还可管理密钥、令牌和管理员',
	},
	needsOwner: '只有“所有者”级别才能管理管理员账户。',
	mintedTitle: '请将此链接发送给 {email}。它仅显示一次。',
	mintedBody: '它只能使用一次，将于 {date} 过期。',
	invite: '邀请',
	invitePlaceholder: 'teammate@company.com',
	inviteLabel: '要邀请的邮箱',
	accessLevelLabel: '访问级别',
	accessLevelFor: '{email} 的访问级别',
	createInvite: '创建邀请链接',
	emptyTitle: '暂无管理员',
	col: {
		operator: '管理员',
		access: '访问权限',
		status: '状态',
		lastSignIn: '上次登录',
	},
	settingUp: '设置中',
	backupCodesLeftOne: '剩余 {n} 个备用码',
	backupCodesLeftMany: '剩余 {n} 个备用码',
	recoveryLink: '恢复链接',
	recoveryConfirm:
		'要为 {email} 创建恢复链接吗？这会使其在所有设备上退出登录；该链接用于设置新密码和新的身份验证器。',
	disable: '禁用',
	enable: '启用',
	disableConfirm: '要禁用 {email} 吗？其将立即被退出登录。',
	pendingLinks: '待使用的链接',
	linkKind: {
		invite: '邀请',
		recovery: '恢复',
	},
	expiresOn: '{date} 过期',
	revoke: '撤销',
};
export default operators;
