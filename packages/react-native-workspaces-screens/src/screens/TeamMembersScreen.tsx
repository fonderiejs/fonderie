import type { IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { useMembers, useRemoveMember } from '@fonderie/react-native-workspaces';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
	const { members, isLoading, error, refresh } = useMembers(client);
	const { removeMember, isLoading: isRemoving, error: removeError } = useRemoveMember(client);

	const handleRemove = async (userId: string) => {
		try {
			await removeMember(userId);
			await refresh();
		} catch {
			// Surfaced via `removeError` from useRemoveMember.
		}
	};

	if (isLoading) return <Text style={styles.status}>Loading team…</Text>;
	if (error)
		return (
			<Text style={styles.error} accessibilityRole="alert">
				{error.explanation}
			</Text>
		);

	const renderMember = ({ item: member }: { item: IMemberDTO }) => (
		<View style={styles.row}>
			<View>
				<Text style={styles.userId}>{member.userId}</Text>
				<Text style={styles.role}>{member.roleName}</Text>
			</View>
			{member.userId !== currentUserId && (
				<TouchableOpacity
					disabled={isRemoving}
					onPress={() => handleRemove(member.userId)}
					style={styles.removeButton}
					accessibilityRole="button"
				>
					<Text style={styles.removeButtonText}>Remove</Text>
				</TouchableOpacity>
			)}
		</View>
	);

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Team members</Text>
				<TouchableOpacity
					onPress={onNavigateToInvite}
					style={styles.inviteButton}
					accessibilityRole="button"
				>
					<Text style={styles.inviteButtonText}>Invite</Text>
				</TouchableOpacity>
			</View>

			{removeError && (
				<Text style={styles.error} accessibilityRole="alert">
					{removeError.explanation}
				</Text>
			)}

			<FlatList data={members} keyExtractor={(m) => m.userId} renderItem={renderMember} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	title: { fontSize: 24, fontWeight: '700' },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	inviteButton: {
		backgroundColor: '#000',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	inviteButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	userId: { fontSize: 14, fontWeight: '600' },
	role: { fontSize: 12, color: '#666' },
	removeButton: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	removeButtonText: { fontSize: 13, color: '#e11d48' },
});
