import type { AuditClient, IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { useAuditEvents } from '@fonderie/react-native-audit';
import { useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

export interface IAuditLogScreenProps {
	client: AuditClient;
}

export function AuditLogScreen({ client }: IAuditLogScreenProps) {
	const [type, setType] = useState('');
	const [actorId, setActorId] = useState('');
	const [expanded, setExpanded] = useState<string | null>(null);

	const filters: IListAuditEventsInput = {};
	if (type) filters.type = type;
	if (actorId) filters.actorId = actorId;

	const { events, isLoading, isLoadingMore, error, hasMore, refresh, loadMore } = useAuditEvents(
		client,
		filters,
	);

	const renderEvent = ({ item: event }: { item: IAuditEventDTO }) => (
		<View style={styles.row}>
			<TouchableOpacity
				onPress={() => setExpanded(expanded === event.id ? null : event.id)}
				style={styles.rowButton}
				accessibilityRole="button"
			>
				<Text style={styles.type}>{event.type}</Text>
				<Text style={styles.meta}>
					{event.actorId ?? 'system'} · {new Date(event.createdAt).toLocaleString()}
				</Text>
			</TouchableOpacity>
			{expanded === event.id && (
				<Text style={styles.payload}>{JSON.stringify(event.payload, null, 2)}</Text>
			)}
		</View>
	);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Audit log</Text>

			<View style={styles.form}>
				<TextInput
					style={styles.input}
					placeholder="Event type"
					value={type}
					onChangeText={setType}
				/>
				<TextInput
					style={styles.input}
					placeholder="Actor ID"
					value={actorId}
					onChangeText={setActorId}
				/>
				<TouchableOpacity
					onPress={() => refresh()}
					style={styles.filterButton}
					accessibilityRole="button"
				>
					<Text style={styles.filterButtonText}>Filter</Text>
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
				<FlatList data={events} keyExtractor={(e) => e.id} renderItem={renderEvent} />
			)}

			{hasMore && (
				<TouchableOpacity
					disabled={isLoadingMore}
					onPress={loadMore}
					style={styles.loadMoreButton}
					accessibilityRole="button"
				>
					{isLoadingMore ? <ActivityIndicator /> : <Text>Load more</Text>}
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
	form: { flexDirection: 'row', gap: 8, marginBottom: 16 },
	input: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
	},
	filterButton: {
		backgroundColor: '#000',
		borderRadius: 8,
		paddingHorizontal: 16,
		justifyContent: 'center',
	},
	filterButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	row: { borderBottomWidth: 1, borderBottomColor: '#eee' },
	rowButton: { paddingVertical: 10 },
	type: { fontSize: 14, fontWeight: '600' },
	meta: { fontSize: 13, color: '#666' },
	payload: {
		backgroundColor: '#f7f7f7',
		borderRadius: 8,
		padding: 12,
		fontSize: 12,
		fontFamily: 'monospace',
		marginBottom: 12,
	},
	loadMoreButton: {
		marginTop: 16,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 12,
		alignItems: 'center',
	},
});
