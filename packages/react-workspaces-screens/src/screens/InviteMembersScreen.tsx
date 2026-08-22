import type { WorkspacesClient } from '@fonderie/client';
import { useInvitations } from '@fonderie/react-workspaces';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface IInviteMembersScreenProps {
	client?: WorkspacesClient;
	onNavigateToMembers?: () => void;
}

export function InviteMembersScreen({ client, onNavigateToMembers }: IInviteMembersScreenProps) {
	const { invitations, isLoading, error, invite, cancelInvitation } = useInvitations(client);
	const [email, setEmail] = useState('');
	const [isInviting, setIsInviting] = useState(false);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setIsInviting(true);
		try {
			await invite({ email });
			setEmail('');
		} catch {
			// Surfaced via `error` from useInvitations.
		} finally {
			setIsInviting(false);
		}
	};

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Invite members</h1>

			<form style={styles.form} onSubmit={handleSubmit}>
				<input
					style={styles.input}
					type="email"
					placeholder="Email address"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					required
				/>
				<button type="submit" disabled={isInviting} style={styles.button}>
					{isInviting ? 'Sending…' : 'Send invite'}
				</button>
			</form>

			{error && (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			)}

			<h2 style={styles.subtitle}>Pending invitations</h2>
			{isLoading ? (
				<p style={styles.status}>Loading…</p>
			) : (
				<ul style={styles.list}>
					{invitations.map((inv) => (
						<li key={inv.id} style={styles.row}>
							<div>
								<p style={styles.email}>{inv.email}</p>
								<p style={styles.meta}>{inv.status}</p>
							</div>
							<button
								type="button"
								onClick={() => cancelInvitation(inv.id)}
								style={styles.cancelButton}
							>
								Cancel
							</button>
						</li>
					))}
				</ul>
			)}

			<button type="button" onClick={onNavigateToMembers} style={styles.link}>
				Back to team
			</button>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 480 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	subtitle: { fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 8 },
	form: { display: 'flex', gap: 8, marginBottom: 12 },
	input: {
		flex: 1,
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: 12,
		fontSize: 14,
	},
	button: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '0 16px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	status: { color: '#666', fontSize: 14 },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '8px 0',
		borderBottom: '1px solid #eee',
	},
	email: { fontSize: 14, fontWeight: 600 },
	meta: { fontSize: 12, color: '#666' },
	cancelButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '4px 10px',
		fontSize: 12,
		cursor: 'pointer',
	},
	link: {
		marginTop: 24,
		background: 'none',
		border: 'none',
		color: '#666',
		cursor: 'pointer',
		fontSize: 14,
	},
};
