import type { CustomersClient, ICustomerDTO } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
import { useCustomers } from '@fonderie/react-customers';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface ICustomersListScreenProps {
	client?: CustomersClient;
	onSelectCustomer?: (customerId: string) => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function CustomersListScreen({
	client,
	onSelectCustomer,
	locale,
}: ICustomersListScreenProps) {
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	const [search, setSearch] = useState('');
	const { customers, isLoading, error, createCustomer, refresh } = useCustomers(
		client,
		search ? { search } : {},
	);
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [companyName, setCompanyName] = useState('');

	const handleCreate = async () => {
		try {
			const input: Parameters<typeof createCustomer>[0] = {};
			if (firstName) input.firstName = firstName;
			if (lastName) input.lastName = lastName;
			if (companyName) input.companyName = companyName;
			await createCustomer(input);
			setFirstName('');
			setLastName('');
			setCompanyName('');
		} catch {
			// Surfaced via `error` from useCustomers.
		}
	};

	// The server writes the name in the order the customer's language uses.
	const displayName = (c: ICustomerDTO) => c.displayName || c.id;

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{t('customers.list.title')}</h1>

			<input
				style={styles.searchInput}
				placeholder={t('customers.list.searchPlaceholder')}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				onKeyDown={(e) => e.key === 'Enter' && refresh()}
			/>

			<div style={styles.form}>
				<input
					style={styles.input}
					placeholder={t('customers.fields.firstName')}
					value={firstName}
					onChange={(e) => setFirstName(e.target.value)}
				/>
				<input
					style={styles.input}
					placeholder={t('customers.fields.lastName')}
					value={lastName}
					onChange={(e) => setLastName(e.target.value)}
				/>
				<input
					style={styles.input}
					placeholder={t('customers.fields.companyOptional')}
					value={companyName}
					onChange={(e) => setCompanyName(e.target.value)}
				/>
				<button type="button" onClick={handleCreate} style={styles.createButton}>
					{t('customers.list.create')}
				</button>
			</div>

			{error && (
				<p style={styles.error} role="alert">
					{errorText(error)}
				</p>
			)}

			{isLoading ? (
				<p style={styles.status}>{t('customers.loading')}</p>
			) : (
				<ul style={styles.list}>
					{customers.map((customer) => (
						<li key={customer.id} style={styles.row}>
							<button
								type="button"
								onClick={() => onSelectCustomer?.(customer.id)}
								style={styles.rowButton}
							>
								<span style={styles.name}>{displayName(customer)}</span>
								{customer.blacklisted.status && (
									<span style={styles.blacklisted}>{t('customers.list.blacklisted')}</span>
								)}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 560 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	searchInput: {
		width: '100%',
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
		marginBottom: 16,
	},
	form: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
	input: {
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
	},
	createButton: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '10px 16px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: { borderBottom: '1px solid #eee' },
	rowButton: {
		width: '100%',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '12px 0',
		background: 'none',
		border: 'none',
		textAlign: 'left',
		cursor: 'pointer',
		font: 'inherit',
	},
	name: { fontSize: 14, fontWeight: 600 },
	blacklisted: { fontSize: 12, color: '#e11d48' },
};
