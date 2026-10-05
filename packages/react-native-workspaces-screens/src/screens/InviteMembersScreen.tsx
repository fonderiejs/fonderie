import type { IInvitationDTO, UiMessageKey, WorkspacesClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
import { useInvitations } from '@fonderie/react-native-workspaces';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface IInviteMembersScreenProps {
	client?: WorkspacesClient;
	onNavigateToMembers?: () => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function InviteMembersScreen({
	client,
	onNavigateToMembers,
	locale,
}: IInviteMembersScreenProps) {
	const { invitations, isLoading, error, invite, cancelInvitation } = useInvitations(client);
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	// A status Fonderie does not know shows as sent by the server.
	const statusLabel = (status: string) => {
		const key = `workspaces.invitationStatus.${status}` as UiMessageKey;
		const text = t(key);
		return text === key ? status : text;
	};
	const [email, setEmail] = useState('');
	const [isInviting, setIsInviting] = useState(false);

	const handleSubmit = async () => {
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

	const renderInvitation = ({ item: inv }: { item: IInvitationDTO }) => (
		<View style={styles.row}>
			<View>
				<Text style={styles.email}>{inv.email}</Text>
				<Text style={styles.meta}>{statusLabel(inv.status)}</Text>
			</View>
			<TouchableOpacity
				onPress={() => cancelInvitation(inv.id)}
				style={styles.cancelButton}
				accessibilityRole="button"
				accessibilityLabel={t('workspaces.invite.a11y.cancel', { email: inv.email })}
			>
				<Text style={styles.cancelButtonText}>{t('workspaces.invite.cancel')}</Text>
			</TouchableOpacity>
		</View>
	);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('workspaces.invite.title')}</Text>

			<View style={styles.form}>
				<TextInput
					style={styles.input}
					placeholder={t('workspaces.invite.email')}
					accessibilityLabel={t('workspaces.invite.a11y.email')}
					accessibilityHint={t('workspaces.invite.a11y.emailHint')}
					value={email}
					onChangeText={setEmail}
					autoCapitalize="none"
					keyboardType="email-address"
				/>
				<TouchableOpacity
					disabled={isInviting}
					onPress={handleSubmit}
					style={styles.button}
					accessibilityRole="button"
					accessibilityLabel={t('workspaces.invite.a11y.submit')}
					accessibilityState={{ disabled: isInviting, busy: isInviting }}
				>
					<Text style={styles.buttonText}>
						{isInviting ? t('workspaces.invite.submitting') : t('workspaces.invite.submitShort')}
					</Text>
				</TouchableOpacity>
			</View>

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{errorText(error)}
				</Text>
			)}

			<Text style={styles.subtitle}>{t('workspaces.invite.pending')}</Text>
			{isLoading ? (
				<Text style={styles.status}>{t('workspaces.invite.loading')}</Text>
			) : (
				<FlatList data={invitations} keyExtractor={(inv) => inv.id} renderItem={renderInvitation} />
			)}

			<TouchableOpacity
				onPress={onNavigateToMembers}
				style={styles.link}
				accessibilityRole="button"
			>
				<Text style={styles.linkText}>{t('workspaces.invite.backToTeam')}</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
	subtitle: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 8 },
	form: { flexDirection: 'row', gap: 8, marginBottom: 12 },
	input: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 12,
		fontSize: 14,
	},
	button: {
		backgroundColor: '#000',
		borderRadius: 8,
		paddingHorizontal: 16,
		justifyContent: 'center',
	},
	buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	status: { color: '#666', fontSize: 14 },
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	email: { fontSize: 14, fontWeight: '600' },
	meta: { fontSize: 12, color: '#666' },
	cancelButton: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		paddingVertical: 4,
		paddingHorizontal: 10,
	},
	cancelButtonText: { fontSize: 12 },
	link: { marginTop: 24 },
	linkText: { color: '#666', fontSize: 14 },
});
