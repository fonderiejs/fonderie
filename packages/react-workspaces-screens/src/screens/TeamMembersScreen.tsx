import type { FonderieApiError, IMemberDTO, UiMessageKey, WorkspacesClient } from '@fonderie/client';
import { formatPersonName } from '@fonderie/client';
import { useUiLocale, useUiT } from '@fonderie/react';
import { useMembers } from '@fonderie/react-workspaces';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface ITeamMembersScreenProps {
	client?: WorkspacesClient;
	currentUserId: string;
	onNavigateToInvite?: () => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function TeamMembersScreen({
	client,
	currentUserId,
	onNavigateToInvite,
	locale,
}: ITeamMembersScreenProps) {
	const { members, isLoading, error, removeMember } = useMembers(client);
	const t = useUiT(client, locale);
	const uiLocale = useUiLocale(client, locale);
	// The member's name in the order the UI language writes it; their email when
	// they have no name; the id only as a last resort.
	const nameOf = (m: IMemberDTO) => formatPersonName(m.firstName, m.lastName, uiLocale) || m.email || m.userId;
	const rolesOf = (m: IMemberDTO) => (m.roles?.length ? m.roles.map((r) => roleLabel(r.name)) : [roleLabel(m.roleName)]).join(', ');
	// System roles are translated; a custom role shows its own name.
	const roleLabel = (roleName: string) => {
		const key = `workspaces.roles.${roleName}` as UiMessageKey;
		const text = t(key);
		return text === key ? roleName : text;
	};
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

	if (isLoading) return <p style={styles.status}>{t('workspaces.members.loading')}</p>;
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
				<h1 style={styles.title}>{t('workspaces.members.title')}</h1>
				<button type="button" onClick={onNavigateToInvite} style={styles.inviteButton}>
					{t('workspaces.members.invite')}
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
							<p style={styles.userId}>{nameOf(member)}</p>
							{nameOf(member) !== member.email && member.email ? <p style={styles.role}>{member.email}</p> : null}
							<p style={styles.role}>{rolesOf(member)}</p>
						</div>
						{member.userId !== currentUserId && (
							<button
								type="button"
								disabled={isRemoving}
								onClick={() => handleRemove(member.userId)}
								aria-label={t('workspaces.members.a11y.remove', { member: nameOf(member) })}
								style={styles.removeButton}
							>
								{t('workspaces.members.remove')}
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
