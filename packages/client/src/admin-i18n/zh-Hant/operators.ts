import type en from '../en/operators';

const operators: typeof en = {
	title: '管理員',
	lead: '可登入此主控台的人員。每位皆使用密碼與驗證器 App；不開放註冊。',
	level: {
		read: '唯讀',
		editor: '編輯者',
		owner: '擁有者',
	},
	levelHint: {
		read: '可瀏覽，不可變更',
		editor: '可變更設定、範本、使用者',
		owner: '另含機密、權杖與管理員',
	},
	needsOwner: '只有「擁有者」等級才能管理管理員帳戶。',
	mintedTitle: '請將此連結傳送給 {email}。連結僅顯示一次。',
	mintedBody: '此連結僅能使用一次，將於 {date} 到期。',
	invite: '邀請',
	invitePlaceholder: 'teammate@company.com',
	inviteLabel: '要邀請的電子郵件',
	accessLevelLabel: '存取等級',
	accessLevelFor: '{email} 的存取等級',
	createInvite: '建立邀請連結',
	emptyTitle: '尚無管理員',
	col: {
		operator: '管理員',
		access: '存取權限',
		status: '狀態',
		lastSignIn: '上次登入',
	},
	settingUp: '設定中',
	backupCodesLeftOne: '剩餘 {n} 組備用碼',
	backupCodesLeftMany: '剩餘 {n} 組備用碼',
	recoveryLink: '復原連結',
	recoveryConfirm:
		'要為 {email} 建立復原連結嗎？這會將其從所有裝置登出；連結將用於設定新密碼與新驗證器。',
	disable: '停用',
	enable: '啟用',
	disableConfirm: '要停用 {email} 嗎？對方將立即被登出。',
	pendingLinks: '待使用的連結',
	linkKind: {
		invite: '邀請',
		recovery: '復原',
	},
	expiresOn: '{date} 到期',
	revoke: '撤銷',
};
export default operators;
