// The prebuilt workspaces screens' words (React, React Native and Vue share them).
// English is canonical: the other languages are typed against this shape, so
// a missing or extra key is a compile error. `{name}` placeholders are
// interpolated; a11y.* are screen-reader labels and hints (React Native).
const workspaces = {
	// System role names from the server; a custom role shows its raw name.
	roles: {
		ADMIN: 'Admin',
		GUEST: 'Guest',
	},
	// Invitation statuses from the server.
	invitationStatus: {
		PENDING: 'Pending',
		ACCEPTED: 'Accepted',
		REJECTED: 'Declined',
		CANCELLED: 'Cancelled',
	},
	members: {
		title: 'Team members',
		loading: 'Loading team…',
		invite: 'Invite',
		remove: 'Remove',
		a11y: {
			invite: 'Invite members',
			remove: 'Remove {member} from the workspace',
		},
	},
	invite: {
		title: 'Invite members',
		email: 'Email address',
		submit: 'Send invite',
		submitShort: 'Send',
		submitting: 'Sending…',
		pending: 'Pending invitations',
		loading: 'Loading…',
		cancel: 'Cancel',
		backToTeam: 'Back to team',
		a11y: {
			email: 'Email input',
			emailHint: 'Enter the email address of the person to invite',
			submit: 'Send invite button',
			cancel: 'Cancel the invitation for {email}',
		},
	},
	accept: {
		title: 'Workspace invitation',
		body: "You've been invited to join a workspace. Accept the invitation to become a member.",
		submit: 'Accept invitation',
		submitting: 'Accepting…',
		notNow: 'Not now',
		acceptedTitle: 'Invitation accepted',
		acceptedBody: "You've joined the workspace.",
		a11y: {
			submit: 'Accept invitation button',
		},
	},
};

export default workspaces;
