import type { AdminClient } from '@fonderie/client';
import { useAttention } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface IAttentionScreenProps {
	client: AdminClient;
}

// What needs the operator today. Empty is green.
export function AttentionScreen({ client }: IAttentionScreenProps) {
	const { attention, isLoading, error, refresh } = useAttention(client);
	return (
		<div style={styles.container}>
			<div style={styles.toolbar}>
				<h1 style={{ ...styles.title, marginBottom: 0 }}>Attention</h1>
				<button
					type="button"
					style={styles.button}
					onClick={() => void refresh()}
					disabled={isLoading}
				>
					Refresh
				</button>
			</div>
			{isLoading && !attention ? (
				<p style={styles.status}>Running the checks…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : attention?.items.length === 0 ? (
				<p style={styles.ok}>
					Nothing needs you. Checked {new Date(attention.generatedAt).toLocaleString()}.
				</p>
			) : (
				<ul style={styles.list}>
					{attention?.items.map((item) => (
						<li key={`${item.source}:${item.message}`} style={styles.row}>
							<span style={item.severity === 'error' ? styles.bad : styles.advice}>
								{item.severity === 'error' ? 'error' : 'advice'}
							</span>{' '}
							<span style={styles.mono}>{item.source}</span> — {item.message}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
