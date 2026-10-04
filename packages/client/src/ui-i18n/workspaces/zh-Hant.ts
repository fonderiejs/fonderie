import type en from './en';

const workspaces: typeof en = {
	roles: {
		ADMIN: '管理員',
		GUEST: '訪客',
	},
	invitationStatus: {
		PENDING: '待接受',
		ACCEPTED: '已接受',
		REJECTED: '已拒絕',
		CANCELLED: '已取消',
	},
	members: {
		title: '團隊成員',
		loading: '正在載入團隊…',
		invite: '邀請',
		remove: '移除',
		a11y: {
			invite: '邀請成員',
			remove: '將 {member} 從工作區移除',
		},
	},
	invite: {
		title: '邀請成員',
		email: '電子郵件地址',
		submit: '傳送邀請',
		submitShort: '傳送',
		submitting: '傳送中…',
		pending: '待處理的邀請',
		loading: '載入中…',
		cancel: '取消',
		backToTeam: '返回團隊',
		a11y: {
			email: '電子郵件輸入欄位',
			emailHint: '輸入受邀者的電子郵件地址',
			submit: '傳送邀請按鈕',
			cancel: '取消對 {email} 的邀請',
		},
	},
	accept: {
		title: '工作區邀請',
		body: '你已受邀加入一個工作區。接受邀請即可成為成員。',
		submit: '接受邀請',
		submitting: '接受中…',
		notNow: '暫時不要',
		acceptedTitle: '已接受邀請',
		acceptedBody: '你已加入此工作區。',
		a11y: {
			submit: '接受邀請按鈕',
		},
	},
};

export default workspaces;
