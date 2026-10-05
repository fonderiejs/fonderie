import type { AuditClient, IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { uiLocaleFor } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
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
	client?: AuditClient;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function AuditLogScreen({ client, locale }: IAuditLogScreenProps) {
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	const dateLocale = locale ?? uiLocaleFor(client)?.get();
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

	const renderEvent = ({ item: event }: { item: IAuditEventDTO }) => {
		const actor = event.actorId ?? t('audit.log.system');
		const date = new Date(event.createdAt).toLocaleString(dateLocale);
		return (
			<View style={styles.row}>
				<TouchableOpacity
					onPress={() => setExpanded(expanded === event.id ? null : event.id)}
					style={styles.rowButton}
					accessibilityRole="button"
					accessibilityLabel={t('audit.log.a11y.event', { type: event.type, actor, date })}
					accessibilityHint={t('audit.log.a11y.eventHint')}
					accessibilityState={{ expanded: expanded === event.id }}
				>
					<Text style={styles.type}>{event.type}</Text>
					<Text style={styles.meta}>
						{actor} · {date}
					</Text>
				</TouchableOpacity>
				{expanded === event.id && (
					<Text style={styles.payload}>{JSON.stringify(event.payload, null, 2)}</Text>
				)}
			</View>
		);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('audit.log.title')}</Text>

			<View style={styles.form}>
				<TextInput
					style={styles.input}
					placeholder={t('audit.log.eventType')}
					accessibilityLabel={t('audit.log.a11y.eventType')}
					accessibilityHint={t('audit.log.a11y.eventTypeHint')}
					value={type}
					onChangeText={setType}
				/>
				<TextInput
					style={styles.input}
					placeholder={t('audit.log.actorId')}
					accessibilityLabel={t('audit.log.a11y.actorId')}
					accessibilityHint={t('audit.log.a11y.actorIdHint')}
					value={actorId}
					onChangeText={setActorId}
				/>
				<TouchableOpacity
					onPress={() => refresh()}
					style={styles.filterButton}
					accessibilityRole="button"
					accessibilityLabel={t('audit.log.a11y.filter')}
				>
					<Text style={styles.filterButtonText}>{t('audit.log.filter')}</Text>
				</TouchableOpacity>
			</View>

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{errorText(error)}
				</Text>
			)}

			{isLoading ? (
				<Text style={styles.status}>{t('audit.log.loading')}</Text>
			) : (
				<FlatList data={events} keyExtractor={(e) => e.id} renderItem={renderEvent} />
			)}

			{hasMore && (
				<TouchableOpacity
					disabled={isLoadingMore}
					onPress={loadMore}
					style={styles.loadMoreButton}
					accessibilityRole="button"
					accessibilityLabel={
						isLoadingMore ? t('audit.log.a11y.loadingMore') : t('audit.log.a11y.loadMore')
					}
					accessibilityState={{ busy: isLoadingMore, disabled: isLoadingMore }}
				>
					{isLoadingMore ? <ActivityIndicator /> : <Text>{t('audit.log.loadMore')}</Text>}
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
