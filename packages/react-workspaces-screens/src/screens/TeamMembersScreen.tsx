import type { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useMembers } from '@fonderie/react-workspaces';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface ITeamMembersScreenProps {
	client?: WorkspacesClient;
	currentUserId: string;
	onNavigateToInvite?: () => void;
}

export function TeamMembersScreen({
	client,
	currentUserId,
	onNavigateToInvite,
}: ITeamMembersScreenProps) {
	const { members, isLoading, error, removeMember } = useMembers(client);
	const [isRemoving, setIsRemoving] = useState(false);
	const [removeError, setRemoveError] = useState<FonderieApiError | null>(null);

	const handleRemove = async (userId: string) => {
		setIsRemoving(true);
		setRemoveError(null);
		try {
			// The list hook re-fetches members itself after the write.
			await removeMember(userId);
		} catch (err) {
			// useMembers normalizes every failure to FonderieApiError before throwing.
			setRemoveError(err as FonderieApiError);
		} finally {
			setIsRemoving(false);
		}
	};

	if (isLoading) return <p style={styles.status}>Loading team…</p>;
	// A failed removal also lands in the hook's shared `error`; it's surfaced
	// inline via `removeError` below, so don't let it replace the list.
	if (error && !removeError)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1 style={styles.title}>Team members</h1>
				<button type="button" onClick={onNavigateToInvite} style={styles.inviteButton}>
					Invite
				</button>
			</div>

			{removeError && (
				<p style={styles.error} role="alert">
					{removeError.explanation}
				</p>
			)}

			<ul style={styles.list}>
				{members.map((member) => (
					<li key={member.userId} style={styles.row}>
						<div>
							<p style={styles.userId}>{member.userId}</p>
							<p style={styles.role}>{member.roleName}</p>
						</div>
						{member.userId !== currentUserId && (
							<button
								type="button"
								disabled={isRemoving}
								onClick={() => handleRemove(member.userId)}
								style={styles.removeButton}
							>
								Remove
							</button>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 480 },
	header: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	title: { fontSize: 24, fontWeight: 700 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	inviteButton: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '8px 16px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '12px 0',
		borderBottom: '1px solid #eee',
	},
	userId: { fontSize: 14, fontWeight: 600 },
	role: { fontSize: 12, color: '#666' },
	removeButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '6px 12px',
		fontSize: 13,
		cursor: 'pointer',
		color: '#e11d48',
	},
};
