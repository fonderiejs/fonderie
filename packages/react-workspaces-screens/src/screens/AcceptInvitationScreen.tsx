import type { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useUiT } from '@fonderie/react';
import { useWorkspaces } from '@fonderie/react-workspaces';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface IAcceptInvitationScreenProps {
	client?: WorkspacesClient;
	// The token from the invitation link (…/invite/<token>) — not the PIN.
	token: string;
	onAccepted?: (workspaceId: string) => void;
	onNavigateBack?: () => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function AcceptInvitationScreen({
	client,
	token,
	onAccepted,
	onNavigateBack,
	locale,
}: IAcceptInvitationScreenProps) {
	// Note: mounting useWorkspaces also fetches the workspace list; its shared
	// isLoading/error track that fetch, so the accept action keeps local state.
	const { acceptInvitation } = useWorkspaces(client);
	const t = useUiT(client, locale);
	const [accepted, setAccepted] = useState(false);
	const [isAccepting, setIsAccepting] = useState(false);
	const [acceptError, setAcceptError] = useState<FonderieApiError | null>(null);

	const handleAccept = async () => {
		setIsAccepting(true);
		setAcceptError(null);
		try {
			// acceptInvitation resolves to the joined workspace's id.
			const workspaceId = await acceptInvitation({ token });
			setAccepted(true);
			onAccepted?.(workspaceId);
		} catch (err) {
			// useWorkspaces normalizes every failure to FonderieApiError before throwing.
			setAcceptError(err as FonderieApiError);
		} finally {
			setIsAccepting(false);
		}
	};

	if (accepted) {
		return (
			<div style={styles.container}>
				<h1 style={styles.title}>{t('workspaces.accept.acceptedTitle')}</h1>
				<p style={styles.body}>{t('workspaces.accept.acceptedBody')}</p>
			</div>
		);
	}

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{t('workspaces.accept.title')}</h1>
			<p style={styles.body}>{t('workspaces.accept.body')}</p>

			{acceptError && (
				<p style={styles.error} role="alert">
					{acceptError.explanation}
				</p>
			)}

			<button type="button" disabled={isAccepting} onClick={handleAccept} style={styles.button}>
				{isAccepting ? t('workspaces.accept.submitting') : t('workspaces.accept.submit')}
			</button>

			<button type="button" onClick={onNavigateBack} style={styles.link}>
				{t('workspaces.accept.notNow')}
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
