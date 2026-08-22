import type { CustomersClient, ICustomerDTO } from '@fonderie/client';
import { useCustomers } from '@fonderie/react-native-customers';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface ICustomersListScreenProps {
	client?: CustomersClient;
	onSelectCustomer?: (customerId: string) => void;
}

export function CustomersListScreen({ client, onSelectCustomer }: ICustomersListScreenProps) {
	const [search, setSearch] = useState('');
	const { customers, isLoading, error, createCustomer } = useCustomers(
		client,
		search ? { search } : {},
	);
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');

	const handleCreate = async () => {
		try {
			const input: Parameters<typeof createCustomer>[0] = {};
			if (firstName) input.firstName = firstName;
			if (lastName) input.lastName = lastName;
			await createCustomer(input);
			setFirstName('');
			setLastName('');
		} catch {
			// Surfaced via `error` from useCustomers.
		}
	};

	const displayName = (c: ICustomerDTO) =>
		c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id;

	const renderCustomer = ({ item: customer }: { item: ICustomerDTO }) => (
		<TouchableOpacity
			onPress={() => onSelectCustomer?.(customer.id)}
			style={styles.row}
			accessibilityRole="button"
		>
			<Text style={styles.name}>{displayName(customer)}</Text>
			{customer.blacklisted.status && <Text style={styles.blacklisted}>Blacklisted</Text>}
		</TouchableOpacity>
	);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Customers</Text>

			<TextInput
				style={styles.input}
				placeholder="Search customers…"
				value={search}
				onChangeText={setSearch}
				autoCapitalize="none"
			/>

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
				<TouchableOpacity
					onPress={handleCreate}
					style={styles.createButton}
					accessibilityRole="button"
				>
					<Text style={styles.createButtonText}>Add customer</Text>
				</TouchableOpacity>
			</View>

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{error.explanation}
				</Text>
			)}

			{isLoading ? (
				<Text style={styles.status}>Loading…</Text>
			) : (
				<FlatList data={customers} keyExtractor={(c) => c.id} renderItem={renderCustomer} />
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
	form: { marginBottom: 16, gap: 8 },
	input: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
		marginBottom: 16,
	},
	createButton: { backgroundColor: '#000', borderRadius: 8, padding: 12, alignItems: 'center' },
	createButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	status: { padding: 12, color: '#666', fontSize: 13 },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	row: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
	},
	name: { fontSize: 14, fontWeight: '600' },
	blacklisted: { fontSize: 12, color: '#e11d48' },
});
