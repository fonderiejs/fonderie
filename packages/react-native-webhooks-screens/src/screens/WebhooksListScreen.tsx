import type { IWebhookEndpointDTO, WebhooksClient } from '@fonderie/client';
import { useWebhookEndpoints } from '@fonderie/react-native-webhooks';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface IWebhooksListScreenProps {
	client?: WebhooksClient;
	onSelectEndpoint?: (endpointId: string) => void;
}

export function WebhooksListScreen({ client, onSelectEndpoint }: IWebhooksListScreenProps) {
	const { endpoints, isLoading, error, createEndpoint, removeEndpoint, testEndpoint } =
		useWebhookEndpoints(client);
	const [isTesting, setIsTesting] = useState(false);
	const [url, setUrl] = useState('');
	const [events, setEvents] = useState('');
	const [newSecret, setNewSecret] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<string | null>(null);

	const handleCreate = async () => {
		try {
			const eventList = events
				.split(',')
				.map((e) => e.trim())
				.filter(Boolean);
			const input: Parameters<typeof createEndpoint>[0] = { url };
			if (eventList.length) input.events = eventList;
			const created = await createEndpoint(input);
			setNewSecret(created.secret);
			setUrl('');
			setEvents('');
		} catch {
			// Surfaced via `error` from useWebhookEndpoints.
		}
	};

	const handleTest = async (endpointId: string) => {
		setIsTesting(true);
		try {
			const result = await testEndpoint(endpointId);
			setTestResult(
				`${endpointId}: ${result.ok ? 'OK' : `failed (${result.status ?? result.error})`}`,
			);
		} catch {
			// Surfaced via `error` from useWebhookEndpoints.
		} finally {
			setIsTesting(false);
		}
	};

	const renderEndpoint = ({ item: endpoint }: { item: IWebhookEndpointDTO }) => (
		<View style={styles.row}>
			<TouchableOpacity
				onPress={() => onSelectEndpoint?.(endpoint.id)}
				style={styles.rowButton}
				accessibilityRole="button"
			>
				<Text style={styles.url}>{endpoint.url}</Text>
				<Text style={endpoint.enabled ? styles.enabled : styles.disabled}>
					{endpoint.enabled ? 'Enabled' : 'Disabled'}
				</Text>
			</TouchableOpacity>
			<TouchableOpacity
				disabled={isTesting}
				onPress={() => handleTest(endpoint.id)}
				style={styles.smallButton}
				accessibilityRole="button"
			>
				<Text>Test</Text>
			</TouchableOpacity>
			<TouchableOpacity
				onPress={() => removeEndpoint(endpoint.id)}
				style={styles.smallButton}
				accessibilityRole="button"
			>
				<Text style={styles.deleteText}>Delete</Text>
			</TouchableOpacity>
		</View>
	);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Webhooks</Text>

			{newSecret && (
				<Text style={styles.secretBanner}>New endpoint secret (shown once): {newSecret}</Text>
			)}
			{testResult && <Text style={styles.status}>{testResult}</Text>}

			<View style={styles.form}>
				<TextInput
					style={styles.input}
					placeholder="https://example.com/webhook"
					value={url}
					onChangeText={setUrl}
					autoCapitalize="none"
				/>
				<TextInput
					style={styles.input}
					placeholder="event.type, event.other (optional)"
					value={events}
					onChangeText={setEvents}
					autoCapitalize="none"
				/>
				<TouchableOpacity
					onPress={handleCreate}
					style={styles.createButton}
					accessibilityRole="button"
				>
					<Text style={styles.createButtonText}>Add endpoint</Text>
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
				<FlatList data={endpoints} keyExtractor={(e) => e.id} renderItem={renderEndpoint} />
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
	secretBanner: {
		backgroundColor: '#fef3c7',
		borderRadius: 8,
		padding: 12,
		fontSize: 13,
		marginBottom: 16,
	},
	form: { marginBottom: 16, gap: 8 },
	input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 },
	createButton: { backgroundColor: '#000', borderRadius: 8, padding: 12, alignItems: 'center' },
	createButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	status: { padding: 12, color: '#666', fontSize: 13 },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#eee',
		paddingVertical: 10,
	},
	rowButton: { flex: 1 },
	url: { fontSize: 14, fontWeight: '600' },
	enabled: { fontSize: 12, color: '#16a34a' },
	disabled: { fontSize: 12, color: '#999' },
	smallButton: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		paddingVertical: 4,
		paddingHorizontal: 10,
	},
	deleteText: { color: '#e11d48' },
});
