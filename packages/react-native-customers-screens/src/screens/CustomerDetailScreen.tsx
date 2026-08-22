import type {
	CustomersClient,
	ICustomerEmailDTO,
	ICustomerNoteDTO,
	ICustomerPhoneDTO,
} from '@fonderie/client';
import {
	useCustomer,
	useCustomerEmails,
	useCustomerNotes,
	useCustomerPhones,
	useCustomerTags,
} from '@fonderie/react-native-customers';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface ICustomerDetailScreenProps {
	client?: CustomersClient;
	customerId: string;
	onNavigateToList?: () => void;
}

export function CustomerDetailScreen({
	client,
	customerId,
	onNavigateToList,
}: ICustomerDetailScreenProps) {
	const { customer, isLoading, error, updateCustomer } = useCustomer(client, customerId, 1);
	const { emails, addEmail, setPrimaryEmail, removeEmail } = useCustomerEmails(client, customerId);
	const { phones, addPhone, setPrimaryPhone, removePhone } = useCustomerPhones(client, customerId);
	const { notes, createNote, deleteNote } = useCustomerNotes(client, customerId);
	const { tags, addTag, removeTag } = useCustomerTags(client, customerId);

	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [newEmail, setNewEmail] = useState('');
	const [newPhone, setNewPhone] = useState('');
	const [newNote, setNewNote] = useState('');
	const [newTag, setNewTag] = useState('');

	useEffect(() => {
		if (!customer) return;
		setFirstName(customer.firstName);
		setLastName(customer.lastName);
	}, [customer]);

	const handleSaveProfile = async () => {
		try {
			await updateCustomer({ firstName, lastName });
		} catch {
			// Surfaced via `error` from useCustomer.
		}
	};

	const handleAddEmail = async () => {
		if (!newEmail.trim()) return;
		try {
			await addEmail({ email: newEmail.trim() });
			setNewEmail('');
		} catch {
			// Surfaced via useCustomerEmails' error state.
		}
	};

	const handleAddPhone = async () => {
		if (!newPhone.trim()) return;
		try {
			await addPhone({ phone: newPhone.trim() });
			setNewPhone('');
		} catch {
			// Surfaced via useCustomerPhones' error state.
		}
	};

	const handleAddNote = async () => {
		if (!newNote.trim()) return;
		try {
			await createNote(newNote.trim());
			setNewNote('');
		} catch {
			// Surfaced via useCustomerNotes' error state.
		}
	};

	const handleAddTag = async () => {
		if (!newTag.trim()) return;
		try {
			await addTag(newTag.trim());
			setNewTag('');
		} catch {
			// Surfaced via useCustomerTags' error state.
		}
	};

	const renderEmail = ({ item: email }: { item: ICustomerEmailDTO }) => (
		<View style={styles.row}>
			<Text style={styles.rowText}>
				{email.email}
				{email.isPrimary ? ' (primary)' : ''}
			</Text>
			<View style={styles.rowActions}>
				{!email.isPrimary && (
					<TouchableOpacity onPress={() => setPrimaryEmail(email.id)} style={styles.smallButton}>
						<Text>Make primary</Text>
					</TouchableOpacity>
				)}
				<TouchableOpacity onPress={() => removeEmail(email.id)} style={styles.smallButton}>
					<Text>Remove</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

	const renderPhone = ({ item: phone }: { item: ICustomerPhoneDTO }) => (
		<View style={styles.row}>
			<Text style={styles.rowText}>
				{phone.phone}
				{phone.isPrimary ? ' (primary)' : ''}
			</Text>
			<View style={styles.rowActions}>
				{!phone.isPrimary && (
					<TouchableOpacity onPress={() => setPrimaryPhone(phone.id)} style={styles.smallButton}>
						<Text>Make primary</Text>
					</TouchableOpacity>
				)}
				<TouchableOpacity onPress={() => removePhone(phone.id)} style={styles.smallButton}>
					<Text>Remove</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

	const renderNote = ({ item: note }: { item: ICustomerNoteDTO }) => (
		<View style={styles.row}>
			<Text style={styles.rowText}>{note.body}</Text>
			<TouchableOpacity onPress={() => deleteNote(note.id)} style={styles.smallButton}>
				<Text>Delete</Text>
			</TouchableOpacity>
		</View>
	);

	if (isLoading) return <Text style={styles.status}>Loading…</Text>;
	if (error)
		return (
			<Text style={styles.error} accessibilityRole="alert">
				{error.explanation}
			</Text>
		);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Customer</Text>

			<View style={styles.form}>
				<TextInput
					style={styles.input}
					placeholder="First name"
					value={firstName}
					onChangeText={setFirstName}
				/>
				<TextInput
					style={styles.input}
					placeholder="Last name"
					value={lastName}
					onChangeText={setLastName}
				/>
				<TouchableOpacity onPress={handleSaveProfile} style={styles.button}>
					<Text style={styles.buttonText}>Save</Text>
				</TouchableOpacity>
			</View>

			<Text style={styles.subtitle}>Emails</Text>
			<FlatList data={emails} keyExtractor={(e) => e.id} renderItem={renderEmail} />
			<View style={styles.inlineForm}>
				<TextInput
					style={styles.inlineInput}
					placeholder="new@email.com"
					value={newEmail}
					onChangeText={setNewEmail}
					autoCapitalize="none"
				/>
				<TouchableOpacity onPress={handleAddEmail} style={styles.smallButton}>
					<Text>Add</Text>
				</TouchableOpacity>
			</View>

			<Text style={styles.subtitle}>Phones</Text>
			<FlatList data={phones} keyExtractor={(p) => p.id} renderItem={renderPhone} />
			<View style={styles.inlineForm}>
				<TextInput
					style={styles.inlineInput}
					placeholder="+1 555 0100"
					value={newPhone}
					onChangeText={setNewPhone}
					autoCapitalize="none"
				/>
				<TouchableOpacity onPress={handleAddPhone} style={styles.smallButton}>
					<Text>Add</Text>
				</TouchableOpacity>
			</View>

			<Text style={styles.subtitle}>Tags</Text>
			<View style={styles.tags}>
				{tags.map((tag) => (
					<TouchableOpacity key={tag} onPress={() => removeTag(tag)} style={styles.tag}>
						<Text>{tag} ×</Text>
					</TouchableOpacity>
				))}
			</View>
			<View style={styles.inlineForm}>
				<TextInput
					style={styles.inlineInput}
					placeholder="new tag"
					value={newTag}
					onChangeText={setNewTag}
				/>
				<TouchableOpacity onPress={handleAddTag} style={styles.smallButton}>
					<Text>Add</Text>
				</TouchableOpacity>
			</View>

			<Text style={styles.subtitle}>Notes</Text>
			<FlatList data={notes} keyExtractor={(n) => n.id} renderItem={renderNote} />
			<View style={styles.inlineForm}>
				<TextInput
					style={styles.inlineInput}
					placeholder="Add a note…"
					value={newNote}
					onChangeText={setNewNote}
				/>
				<TouchableOpacity onPress={handleAddNote} style={styles.smallButton}>
					<Text>Add</Text>
				</TouchableOpacity>
			</View>

			<TouchableOpacity onPress={onNavigateToList} style={styles.link}>
				<Text style={styles.linkText}>Back to customers</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
	subtitle: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 8 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	form: { gap: 8 },
	input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 },
	inlineForm: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
	inlineInput: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
	},
	button: {
		marginTop: 8,
		backgroundColor: '#000',
		borderRadius: 8,
		padding: 12,
		alignItems: 'center',
	},
	buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	smallButton: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		paddingVertical: 4,
		paddingHorizontal: 10,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
		gap: 8,
	},
	rowText: { fontSize: 14, flex: 1 },
	rowActions: { flexDirection: 'row', gap: 8 },
	tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	tag: {
		backgroundColor: '#f3f4f6',
		borderRadius: 999,
		paddingVertical: 4,
		paddingHorizontal: 10,
	},
	link: { marginTop: 24 },
	linkText: { color: '#666', fontSize: 14 },
});
