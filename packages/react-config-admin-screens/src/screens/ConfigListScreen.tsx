import type { ConfigAdminClient } from '@fonderie/client';
import { useConfigEntries, useRevealSecret, useSecrets } from '@fonderie/react-config-admin';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface IConfigListScreenProps {
	client: ConfigAdminClient;
	environment?: string;
	onSelectConfig?: (key: string) => void;
	onSelectSecret?: (key: string) => void;
}

export function ConfigListScreen({
	client,
	environment,
	onSelectConfig,
	onSelectSecret,
}: IConfigListScreenProps) {
	const {
		entries,
		isLoading: isLoadingConfig,
		error: configError,
	} = useConfigEntries(client, environment);
	const {
		secrets,
		isLoading: isLoadingSecrets,
		error: secretsError,
	} = useSecrets(client, environment);
	const { revealSecret, isLoading: isRevealing } = useRevealSecret(client);
	const [revealed, setRevealed] = useState<Record<string, string>>({});

	const handleReveal = async (key: string) => {
		try {
			const value = await revealSecret(key, environment);
			setRevealed((prev) => ({ ...prev, [key]: value }));
		} catch {
			// Surfaced via useRevealSecret's own error state per-call; kept local here.
		}
	};

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Config</h1>
			{isLoadingConfig ? (
				<p style={styles.status}>Loading…</p>
			) : configError ? (
				<p style={styles.error} role="alert">
					{configError.explanation}
				</p>
			) : (
				<ul style={styles.list}>
					{entries.map((entry) => (
						<li key={`${entry.key}:${entry.environment}`} style={styles.row}>
							<button
								type="button"
								onClick={() => onSelectConfig?.(entry.key)}
								style={styles.rowButton}
							>
								<span style={styles.key}>{entry.key}</span>
								<span style={styles.env}>{entry.environment}</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<h1 style={styles.title}>Secrets</h1>
			{isLoadingSecrets ? (
				<p style={styles.status}>Loading…</p>
			) : secretsError ? (
				<p style={styles.error} role="alert">
					{secretsError.explanation}
				</p>
			) : (
				<ul style={styles.list}>
					{secrets.map((secret) => (
						<li key={`${secret.key}:${secret.environment}`} style={styles.row}>
							<button
								type="button"
								onClick={() => onSelectSecret?.(secret.key)}
								style={styles.rowButton}
							>
								<span style={styles.key}>{secret.key}</span>
								<span style={styles.env}>{secret.environment}</span>
							</button>
							<span style={styles.revealed}>{revealed[secret.key] ?? '••••••••'}</span>
							<button
								type="button"
								disabled={isRevealing}
								onClick={() => handleReveal(secret.key)}
								style={styles.revealButton}
							>
								Reveal
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
	title: { fontSize: 20, fontWeight: 700, marginTop: 24, marginBottom: 12 },
	status: { padding: 12, color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: {
		display: 'flex',
		alignItems: 'center',
		gap: 12,
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
	key: { fontSize: 14, fontWeight: 600 },
	env: { fontSize: 13, color: '#666' },
	revealed: { fontSize: 13, fontFamily: 'monospace', color: '#333', minWidth: 100 },
	revealButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '4px 10px',
		fontSize: 12,
		cursor: 'pointer',
	},
};
