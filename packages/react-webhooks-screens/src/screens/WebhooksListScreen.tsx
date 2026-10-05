import type { WebhooksClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
import { useWebhookEndpoints } from '@fonderie/react-webhooks';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface IWebhooksListScreenProps {
	client?: WebhooksClient;
	onSelectEndpoint?: (endpointId: string) => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function WebhooksListScreen({ client, onSelectEndpoint, locale }: IWebhooksListScreenProps) {
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	const { endpoints, isLoading, error, createEndpoint, removeEndpoint, testEndpoint } =
		useWebhookEndpoints(client);
	const [isTesting, setIsTesting] = useState(false);
	const [url, setUrl] = useState('');
	const [events, setEvents] = useState('');
	const [newSecret, setNewSecret] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<string | null>(null);

	const handleCreate = async (event: FormEvent) => {
		event.preventDefault();
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
				result.ok
					? t('webhooks.list.testOk', { endpoint: endpointId })
					: t('webhooks.list.testFailed', {
							endpoint: endpointId,
							reason: String(result.status ?? result.error),
						}),
			);
		} catch {
			// Surfaced via `error` from useWebhookEndpoints.
		} finally {
			setIsTesting(false);
		}
	};

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{t('webhooks.list.title')}</h1>

			{newSecret && (
				<p style={styles.secretBanner}>
					{t('webhooks.list.newSecret')} <code>{newSecret}</code>
				</p>
			)}
			{testResult && <p style={styles.status}>{testResult}</p>}

			<form style={styles.form} onSubmit={handleCreate}>
				<input
					style={styles.input}
					placeholder={t('webhooks.list.urlPlaceholder')}
					aria-label={t('webhooks.list.a11y.url')}
					value={url}
					onChange={(event) => setUrl(event.target.value)}
					required
				/>
				<input
					style={styles.input}
					placeholder={t('webhooks.list.eventsPlaceholder')}
					aria-label={t('webhooks.list.a11y.events')}
					value={events}
					onChange={(event) => setEvents(event.target.value)}
				/>
				<button type="submit" style={styles.createButton}>
					{t('webhooks.list.add')}
				</button>
			</form>

			{error && (
				<p style={styles.error} role="alert">
					{errorText(error)}
				</p>
			)}

			{isLoading ? (
				<p style={styles.status}>{t('webhooks.loading')}</p>
			) : (
				<ul style={styles.list}>
					{endpoints.map((endpoint) => (
						<li key={endpoint.id} style={styles.row}>
							<button
								type="button"
								onClick={() => onSelectEndpoint?.(endpoint.id)}
								style={styles.rowButton}
							>
								<span style={styles.url}>{endpoint.url}</span>
								<span style={endpoint.enabled ? styles.enabled : styles.disabled}>
									{endpoint.enabled ? t('webhooks.enabled') : t('webhooks.disabled')}
								</span>
							</button>
							<button
								type="button"
								disabled={isTesting}
								onClick={() => handleTest(endpoint.id)}
								style={styles.smallButton}
								aria-label={t('webhooks.list.a11y.test', { url: endpoint.url })}
							>
								{t('webhooks.list.test')}
							</button>
							<button
								type="button"
								onClick={() => removeEndpoint(endpoint.id)}
								style={styles.deleteButton}
								aria-label={t('webhooks.list.a11y.delete', { url: endpoint.url })}
							>
								{t('webhooks.list.delete')}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 640 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	secretBanner: {
		background: '#fef3c7',
		borderRadius: 8,
		padding: 12,
		fontSize: 13,
		marginBottom: 16,
		wordBreak: 'break-all',
	},
	form: { display: 'flex', gap: 8, marginBottom: 16 },
	input: { flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 14 },
	createButton: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '0 16px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
	status: { padding: 12, color: '#666', fontSize: 13 },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		borderBottom: '1px solid #eee',
		padding: '10px 0',
	},
	rowButton: {
		flex: 1,
		display: 'flex',
		justifyContent: 'space-between',
		background: 'none',
		border: 'none',
		cursor: 'pointer',
		textAlign: 'left',
		padding: 0,
	},
	url: { fontSize: 14, fontWeight: 600 },
	enabled: { fontSize: 12, color: '#16a34a' },
	disabled: { fontSize: 12, color: '#999' },
	smallButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '4px 10px',
		fontSize: 12,
		cursor: 'pointer',
	},
	deleteButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '4px 10px',
		fontSize: 12,
		cursor: 'pointer',
		color: '#e11d48',
	},
};
