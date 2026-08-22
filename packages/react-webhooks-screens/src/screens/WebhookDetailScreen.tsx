import type { WebhooksClient } from '@fonderie/client';
import { useWebhookDeliveries, useWebhookEndpoint } from '@fonderie/react-webhooks';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';

export interface IWebhookDetailScreenProps {
	client?: WebhooksClient;
	endpointId: string;
	onNavigateToList?: () => void;
}

export function WebhookDetailScreen({
	client,
	endpointId,
	onNavigateToList,
}: IWebhookDetailScreenProps) {
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

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
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

	if (isLoading) return <p style={styles.status}>Loading…</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Webhook endpoint</h1>

			<form style={styles.form} onSubmit={handleSubmit}>
				<label style={styles.label} htmlFor="webhook-url">
					URL
				</label>
				<input
					id="webhook-url"
					style={styles.input}
					value={url}
					onChange={(event) => setUrl(event.target.value)}
					required
				/>

				<label style={styles.label} htmlFor="webhook-events">
					Events (comma-separated)
				</label>
				<input
					id="webhook-events"
					style={styles.input}
					value={events}
					onChange={(event) => setEvents(event.target.value)}
				/>

				<label style={styles.checkboxLabel}>
					<input
						type="checkbox"
						checked={enabled}
						onChange={(event) => setEnabled(event.target.checked)}
					/>
					Enabled
				</label>

				<button type="submit" style={styles.button}>
					Save
				</button>
			</form>

			<h2 style={styles.subtitle}>Deliveries</h2>
			{isLoadingDeliveries ? (
				<p style={styles.status}>Loading…</p>
			) : (
				<ul style={styles.list}>
					{deliveries.map((delivery) => (
						<li key={delivery.id} style={styles.row}>
							<span style={styles.eventType}>{delivery.eventType}</span>
							<span style={styles.meta}>
								{delivery.status} · {delivery.attempts} attempt{delivery.attempts === 1 ? '' : 's'}
								{delivery.responseStatus !== null ? ` · HTTP ${delivery.responseStatus}` : ''}
							</span>
						</li>
					))}
				</ul>
			)}

			<button type="button" onClick={onNavigateToList} style={styles.link}>
				Back to webhooks
			</button>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 640 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	form: { display: 'flex', flexDirection: 'column', gap: 4 },
	label: { fontSize: 13, fontWeight: 600, marginTop: 12 },
	input: { border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 14 },
	checkboxLabel: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 },
	button: {
		marginTop: 16,
		backgroundColor: '#000',
		color: '#fff',
		padding: '10px 20px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
		alignSelf: 'flex-start',
	},
	subtitle: { fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 8 },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: {
		display: 'flex',
		flexDirection: 'column',
		gap: 2,
		borderBottom: '1px solid #eee',
		padding: '8px 0',
	},
	eventType: { fontSize: 14, fontWeight: 600 },
	meta: { fontSize: 12, color: '#666' },
	link: {
		marginTop: 24,
		background: 'none',
		border: 'none',
		color: '#666',
		cursor: 'pointer',
		fontSize: 14,
	},
};
