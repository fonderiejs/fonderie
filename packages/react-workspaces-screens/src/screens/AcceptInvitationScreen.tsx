import type { WorkspacesClient } from '@fonderie/client';
import { useAcceptInvitation } from '@fonderie/react-workspaces';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface IAcceptInvitationScreenProps {
	client?: WorkspacesClient;
	// The invitation pin/token from the invite email.
	token: string;
	onAccepted?: (workspaceId: string) => void;
	onNavigateBack?: () => void;
}

export function AcceptInvitationScreen({
	client,
	token,
	onAccepted,
	onNavigateBack,
}: IAcceptInvitationScreenProps) {
	const { acceptInvitation, isLoading, error } = useAcceptInvitation(client);
	const [accepted, setAccepted] = useState(false);

	const handleAccept = async () => {
		try {
			const workspaceId = await acceptInvitation(token);
			setAccepted(true);
			onAccepted?.(workspaceId);
		} catch {
			// Surfaced via `error` from useAcceptInvitation.
		}
	};

	if (accepted) {
		return (
			<div style={styles.container}>
				<h1 style={styles.title}>Invitation accepted</h1>
				<p style={styles.body}>You've joined the workspace.</p>
			</div>
		);
	}

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Workspace invitation</h1>
			<p style={styles.body}>
				You've been invited to join a workspace. Accept the invitation to become a member.
			</p>

			{error && (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			)}

			<button type="button" disabled={isLoading} onClick={handleAccept} style={styles.button}>
				{isLoading ? 'Accepting…' : 'Accept invitation'}
			</button>

			<button type="button" onClick={onNavigateBack} style={styles.link}>
				Not now
			</button>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: {
		padding: 24,
		maxWidth: 480,
		display: 'flex',
		flexDirection: 'column',
	},
	title: { fontSize: 24, fontWeight: 700, marginBottom: 12 },
	body: { fontSize: 14, color: '#666', marginBottom: 24 },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	button: {
		backgroundColor: '#000',
		color: '#fff',
		padding: 14,
		borderRadius: 8,
		border: 'none',
		fontSize: 16,
		fontWeight: 600,
		cursor: 'pointer',
		marginTop: 8,
	},
	link: {
		marginTop: 16,
		background: 'none',
		border: 'none',
		color: '#666',
		cursor: 'pointer',
		fontSize: 14,
	},
};
