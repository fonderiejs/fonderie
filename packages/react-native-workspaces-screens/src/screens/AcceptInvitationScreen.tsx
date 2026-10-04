import type { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useUiT } from '@fonderie/react';
import { useWorkspaces } from '@fonderie/react-native-workspaces';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
			<View style={styles.container}>
				<Text style={styles.title}>{t('workspaces.accept.acceptedTitle')}</Text>
				<Text style={styles.body}>{t('workspaces.accept.acceptedBody')}</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('workspaces.accept.title')}</Text>
			<Text style={styles.body}>{t('workspaces.accept.body')}</Text>

			{acceptError && (
				<Text style={styles.error} accessibilityRole="alert">
					{acceptError.explanation}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleAccept}
				disabled={isAccepting}
				style={styles.button}
				accessibilityLabel={t('workspaces.accept.a11y.submit')}
				accessibilityState={{ disabled: isAccepting, busy: isAccepting }}
				accessibilityRole="button"
			>
				{isAccepting ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('workspaces.accept.submit')}</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateBack} accessibilityRole="button">
				<Text style={styles.link}>{t('workspaces.accept.notNow')}</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1, justifyContent: 'center' },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
	body: { fontSize: 14, color: '#666', marginBottom: 24 },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	button: {
		backgroundColor: '#000',
		padding: 14,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 8,
	},
	buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
	link: { marginTop: 16, textAlign: 'center', color: '#666' },
});
