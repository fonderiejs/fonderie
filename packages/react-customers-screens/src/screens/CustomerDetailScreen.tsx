import type { CustomersClient } from '@fonderie/client';
import {
	useCustomer,
	useCustomerEmails,
	useCustomerNotes,
	useCustomerPhones,
	useCustomerTags,
} from '@fonderie/react-customers';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';

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
	const [companyName, setCompanyName] = useState('');
	const [newEmail, setNewEmail] = useState('');
	const [newPhone, setNewPhone] = useState('');
	const [newNote, setNewNote] = useState('');
	const [newTag, setNewTag] = useState('');

	useEffect(() => {
		if (!customer) return;
		setFirstName(customer.firstName);
		setLastName(customer.lastName);
		setCompanyName(customer.companyName);
	}, [customer]);

	const handleSaveProfile = async (e: FormEvent) => {
		e.preventDefault();
		try {
			await updateCustomer({ firstName, lastName, companyName });
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

	if (isLoading) return <p style={styles.status}>Loading…</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Customer</h1>

			<form style={styles.form} onSubmit={handleSaveProfile}>
				<input
					style={styles.input}
					placeholder="First name"
					value={firstName}
					onChange={(e) => setFirstName(e.target.value)}
				/>
				<input
					style={styles.input}
					placeholder="Last name"
					value={lastName}
					onChange={(e) => setLastName(e.target.value)}
				/>
				<input
					style={styles.input}
					placeholder="Company"
					value={companyName}
					onChange={(e) => setCompanyName(e.target.value)}
				/>
				<button type="submit" style={styles.button}>
					Save
				</button>
			</form>

			<h2 style={styles.subtitle}>Emails</h2>
			<ul style={styles.list}>
				{emails.map((email) => (
					<li key={email.id} style={styles.row}>
						<span>
							{email.email} {email.isPrimary && <em style={styles.primary}>primary</em>}
						</span>
						<span style={styles.rowActions}>
							{!email.isPrimary && (
								<button
									type="button"
									onClick={() => setPrimaryEmail(email.id)}
									style={styles.smallButton}
								>
									Make primary
								</button>
							)}
							<button
								type="button"
								onClick={() => removeEmail(email.id)}
								style={styles.smallButton}
							>
								Remove
							</button>
						</span>
					</li>
				))}
			</ul>
			<div style={styles.inlineForm}>
				<input
					style={styles.input}
					placeholder="new@email.com"
					value={newEmail}
					onChange={(e) => setNewEmail(e.target.value)}
				/>
				<button type="button" onClick={handleAddEmail} style={styles.smallButton}>
					Add
				</button>
			</div>

			<h2 style={styles.subtitle}>Phones</h2>
			<ul style={styles.list}>
				{phones.map((phone) => (
					<li key={phone.id} style={styles.row}>
						<span>
							{phone.phone} {phone.isPrimary && <em style={styles.primary}>primary</em>}
						</span>
						<span style={styles.rowActions}>
							{!phone.isPrimary && (
								<button
									type="button"
									onClick={() => setPrimaryPhone(phone.id)}
									style={styles.smallButton}
								>
									Make primary
								</button>
							)}
							<button
								type="button"
								onClick={() => removePhone(phone.id)}
								style={styles.smallButton}
							>
								Remove
							</button>
						</span>
					</li>
				))}
			</ul>
			<div style={styles.inlineForm}>
				<input
					style={styles.input}
					placeholder="+1 555 0100"
					value={newPhone}
					onChange={(e) => setNewPhone(e.target.value)}
				/>
				<button type="button" onClick={handleAddPhone} style={styles.smallButton}>
					Add
				</button>
			</div>

			<h2 style={styles.subtitle}>Tags</h2>
			<div style={styles.tags}>
				{tags.map((tag) => (
					<span key={tag} style={styles.tag}>
						{tag}
						<button type="button" onClick={() => removeTag(tag)} style={styles.tagRemove}>
							×
						</button>
					</span>
				))}
			</div>
			<div style={styles.inlineForm}>
				<input
					style={styles.input}
					placeholder="new tag"
					value={newTag}
					onChange={(e) => setNewTag(e.target.value)}
				/>
				<button type="button" onClick={handleAddTag} style={styles.smallButton}>
					Add
				</button>
			</div>

			<h2 style={styles.subtitle}>Notes</h2>
			<ul style={styles.list}>
				{notes.map((note) => (
					<li key={note.id} style={styles.noteRow}>
						<p style={styles.noteBody}>{note.body}</p>
						<button type="button" onClick={() => deleteNote(note.id)} style={styles.smallButton}>
							Delete
						</button>
					</li>
				))}
			</ul>
			<div style={styles.inlineForm}>
				<input
					style={styles.input}
					placeholder="Add a note…"
					value={newNote}
					onChange={(e) => setNewNote(e.target.value)}
				/>
				<button type="button" onClick={handleAddNote} style={styles.smallButton}>
					Add
				</button>
			</div>

			<button type="button" onClick={onNavigateToList} style={styles.link}>
				Back to customers
			</button>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 560 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	subtitle: { fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 8 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	form: { display: 'flex', flexDirection: 'column', gap: 8 },
	inlineForm: { display: 'flex', gap: 8, marginTop: 8 },
	input: {
		flex: 1,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
	},
	button: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '10px 16px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
	smallButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '6px 12px',
		fontSize: 13,
		cursor: 'pointer',
	},
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '8px 0',
		borderBottom: '1px solid #eee',
		fontSize: 14,
	},
	rowActions: { display: 'flex', gap: 8 },
	primary: { fontSize: 11, color: '#16a34a', marginLeft: 6, fontStyle: 'normal' },
	tags: { display: 'flex', flexWrap: 'wrap', gap: 8 },
	tag: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 4,
		backgroundColor: '#f3f4f6',
		borderRadius: 999,
		padding: '4px 10px',
		fontSize: 13,
	},
	tagRemove: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 },
	noteRow: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		padding: '8px 0',
		borderBottom: '1px solid #eee',
		gap: 8,
	},
	noteBody: { fontSize: 14, margin: 0, flex: 1 },
	link: {
		marginTop: 24,
		background: 'none',
		border: 'none',
		color: '#666',
		fontSize: 14,
		cursor: 'pointer',
	},
};
