import type en from './en';

const workspaces: typeof en = {
	roles: {
		ADMIN: '管理员',
		GUEST: '访客',
	},
	invitationStatus: {
		PENDING: '待接受',
		ACCEPTED: '已接受',
		REJECTED: '已拒绝',
		CANCELLED: '已取消',
	},
	members: {
		title: '团队成员',
		loading: '正在加载团队…',
		invite: '邀请',
		remove: '移除',
		a11y: {
			invite: '邀请成员',
			remove: '将 {member} 移出工作区',
		},
	},
	invite: {
		title: '邀请成员',
		email: '邮箱地址',
		submit: '发送邀请',
		submitShort: '发送',
		submitting: '正在发送…',
		pending: '待处理的邀请',
		loading: '正在加载…',
		cancel: '取消',
		backToTeam: '返回团队',
		a11y: {
			email: '邮箱输入框',
			emailHint: '输入被邀请人的邮箱地址',
			submit: '发送邀请按钮',
			cancel: '取消对 {email} 的邀请',
		},
	},
	accept: {
		title: '工作区邀请',
		body: '你已受邀加入一个工作区。接受邀请即可成为成员。',
		submit: '接受邀请',
		submitting: '正在接受…',
		notNow: '暂不',
		acceptedTitle: '已接受邀请',
		acceptedBody: '你已加入该工作区。',
		a11y: {
			submit: '接受邀请按钮',
		},
	},
};

export default workspaces;
