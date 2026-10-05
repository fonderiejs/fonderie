import type { FonderieApiError, IMemberDTO, UiMessageKey, WorkspacesClient } from '@fonderie/client';
import { formatPersonName } from '@fonderie/client';
import { useUiError, useUiLocale, useUiT } from '@fonderie/react';
import { useMembers } from '@fonderie/react-native-workspaces';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
	const errorText = useUiError(client, locale);
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

	if (isLoading) return <Text style={styles.status}>{t('workspaces.members.loading')}</Text>;
	// A failed removal also lands in the hook's shared `error`; it's surfaced
	// inline via `removeError` below, so don't let it replace the list.
	if (error && !removeError)
		return (
			<Text style={styles.error} accessibilityRole="alert">
				{errorText(error)}
			</Text>
		);

	const renderMember = ({ item: member }: { item: IMemberDTO }) => (
		<View style={styles.row}>
			<View>
				<Text style={styles.userId}>{nameOf(member)}</Text>
				{nameOf(member) !== member.email && member.email ? <Text style={styles.role}>{member.email}</Text> : null}
				<Text style={styles.role}>{rolesOf(member)}</Text>
			</View>
			{member.userId !== currentUserId && (
				<TouchableOpacity
					disabled={isRemoving}
					onPress={() => handleRemove(member.userId)}
					style={styles.removeButton}
					accessibilityRole="button"
					accessibilityLabel={t('workspaces.members.a11y.remove', { member: nameOf(member) })}
				>
					<Text style={styles.removeButtonText}>{t('workspaces.members.remove')}</Text>
				</TouchableOpacity>
			)}
		</View>
	);

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>{t('workspaces.members.title')}</Text>
				<TouchableOpacity
					onPress={onNavigateToInvite}
					style={styles.inviteButton}
					accessibilityRole="button"
					accessibilityLabel={t('workspaces.members.a11y.invite')}
				>
					<Text style={styles.inviteButtonText}>{t('workspaces.members.invite')}</Text>
				</TouchableOpacity>
			</View>

			{removeError && (
				<Text style={styles.error} accessibilityRole="alert">
					{errorText(removeError)}
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
