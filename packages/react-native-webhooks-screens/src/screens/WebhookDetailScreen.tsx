import type { IWebhookDeliveryDTO, WebhooksClient } from '@fonderie/client';
import { useUiT } from '@fonderie/react';
import { useWebhookDeliveries, useWebhookEndpoint } from '@fonderie/react-native-webhooks';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface IWebhookDetailScreenProps {
	client?: WebhooksClient;
	endpointId: string;
	onNavigateToList?: () => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function WebhookDetailScreen({
	client,
	endpointId,
	onNavigateToList,
	locale,
}: IWebhookDetailScreenProps) {
	const t = useUiT(client, locale);
	const { endpoint, isLoading, error, updateEndpoint } = useWebhookEndpoint(client, endpointId);
	const { deliveries, isLoading: isLoadingDeliveries } = useWebhookDeliveries(client, endpointId);

	const [url, setUrl] = useState('');
	const [events, setEvents] = useState('');
	const [enabled, setEnabled] = useState(true);

	useEffect(() => {
		if (!endpoint) return;
		setUrl(endpoint.url);
		setEvents(endpoint.events.join(', '));
		setEnabled(endpoint.enabled);
	}, [endpoint]);

	const handleSubmit = async () => {
		try {
			await updateEndpoint({
				url,
				events: events
					.split(',')
					.map((e) => e.trim())
					.filter(Boolean),
				enabled,
			});
		} catch {
			// Surfaced via `error` from useWebhookEndpoint.
		}
	};

	const statusLabel = (status: string) =>
		status === 'pending' || status === 'delivered' || status === 'failed'
			? t(`webhooks.status.${status}`)
			: status;

	const renderDelivery = ({ item: delivery }: { item: IWebhookDeliveryDTO }) => (
		<View style={styles.row}>
			<Text style={styles.eventType}>{delivery.eventType}</Text>
			<Text style={styles.meta}>
				{statusLabel(delivery.status)} ·{' '}
				{t(
					delivery.attempts === 1 ? 'webhooks.detail.attemptsOne' : 'webhooks.detail.attemptsOther',
					{ count: delivery.attempts },
				)}
				{delivery.responseStatus !== null ? ` · HTTP ${delivery.responseStatus}` : ''}
			</Text>
		</View>
	);

	if (isLoading) return <Text style={styles.status}>{t('webhooks.loading')}</Text>;
	if (error)
		return (
			<Text style={styles.error} accessibilityRole="alert">
				{error.explanation}
			</Text>
		);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('webhooks.detail.title')}</Text>

			<View style={styles.form}>
				<TextInput
					style={styles.input}
					placeholder={t('webhooks.detail.url')}
					accessibilityLabel={t('webhooks.detail.a11y.url')}
					value={url}
					onChangeText={setUrl}
					autoCapitalize="none"
				/>
				<TextInput
					style={styles.input}
					placeholder={t('webhooks.detail.events')}
					accessibilityLabel={t('webhooks.detail.a11y.events')}
					value={events}
					onChangeText={setEvents}
					autoCapitalize="none"
				/>
				<TouchableOpacity
					onPress={() => setEnabled((v) => !v)}
					style={styles.checkboxRow}
					accessibilityRole="switch"
					accessibilityState={{ checked: enabled }}
					accessibilityLabel={t('webhooks.detail.a11y.enabled')}
				>
					<Text>
						{enabled ? '☑' : '☐'} {t('webhooks.enabled')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={handleSubmit}
					style={styles.button}
					accessibilityRole="button"
					accessibilityLabel={t('webhooks.detail.a11y.save')}
				>
					<Text style={styles.buttonText}>{t('webhooks.detail.save')}</Text>
				</TouchableOpacity>
			</View>

			<Text style={styles.subtitle}>{t('webhooks.detail.deliveries')}</Text>
			{isLoadingDeliveries ? (
				<Text style={styles.status}>{t('webhooks.loading')}</Text>
			) : (
				<FlatList data={deliveries} keyExtractor={(d) => d.id} renderItem={renderDelivery} />
			)}

			<TouchableOpacity onPress={onNavigateToList} style={styles.link}>
				<Text style={styles.linkText}>{t('webhooks.detail.back')}</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	form: { gap: 8 },
	input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 },
	checkboxRow: { paddingVertical: 8 },
	button: {
		marginTop: 8,
		backgroundColor: '#000',
		borderRadius: 8,
		padding: 12,
		alignItems: 'center',
	},
	buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	subtitle: { fontSize: 16, fontWeight: '600', marginTop: 32, marginBottom: 8 },
	row: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 8 },
	eventType: { fontSize: 14, fontWeight: '600' },
	meta: { fontSize: 12, color: '#666' },
	link: { marginTop: 24 },
	linkText: { color: '#666', fontSize: 14 },
});
