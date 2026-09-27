// English — canonical: this shape defines the keys fr and es must match.
const operators = {
	title: 'Operators',
	lead: 'The people who can sign in to this console. Each one uses a password and an authenticator app; there is no sign-up.',
	level: {
		read: 'Read only',
		editor: 'Editor',
		owner: 'Owner',
	},
	levelHint: {
		read: 'look around, change nothing',
		editor: 'change config, templates, users',
		owner: 'secrets, tokens and operators too',
	},
	needsOwner: 'Managing operators needs the Owner level.',
	mintedTitle: 'Send this link to {email}. It is shown once.',
	mintedBody: 'It works once and expires {date}.',
	invite: 'Invite',
	invitePlaceholder: 'teammate@company.com',
	inviteLabel: 'Email to invite',
	accessLevelLabel: 'Access level',
	accessLevelFor: 'Access level for {email}',
	createInvite: 'Create invite link',
	emptyTitle: 'No operators yet',
	col: {
		operator: 'Operator',
		access: 'Access',
		status: 'Status',
		lastSignIn: 'Last sign-in',
	},
	settingUp: 'setting up',
	backupCodesLeftOne: '{n} backup code left',
	backupCodesLeftMany: '{n} backup codes left',
	recoveryLink: 'Recovery link',
	recoveryConfirm:
		'Create a recovery link for {email}? It signs them out everywhere; the link sets a new password and a new authenticator.',
	disable: 'Disable',
	enable: 'Enable',
	disableConfirm: 'Disable {email}? They are signed out immediately.',
	pendingLinks: 'Pending links',
	linkKind: {
		invite: 'invite',
		recovery: 'recovery',
	},
	expiresOn: 'expires {date}',
	revoke: 'Revoke',
};
export default operators;
