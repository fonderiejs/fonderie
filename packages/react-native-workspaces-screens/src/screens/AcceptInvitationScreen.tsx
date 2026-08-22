import type { WorkspacesClient } from '@fonderie/client';
import { useAcceptInvitation } from '@fonderie/react-native-workspaces';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
			<View style={styles.container}>
				<Text style={styles.title}>Invitation accepted</Text>
				<Text style={styles.body}>You've joined the workspace.</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Workspace invitation</Text>
			<Text style={styles.body}>
				You've been invited to join a workspace. Accept the invitation to become a member.
			</Text>

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{error.explanation}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleAccept}
				disabled={isLoading}
				style={styles.button}
				accessibilityLabel="Accept invitation button"
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Accept invitation</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateBack}>
				<Text style={styles.link}>Not now</Text>
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
