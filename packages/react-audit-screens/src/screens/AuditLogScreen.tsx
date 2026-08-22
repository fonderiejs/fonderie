import type { AuditClient, IListAuditEventsInput } from '@fonderie/client';
import { useAuditEvents } from '@fonderie/react-audit';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface IAuditLogScreenProps {
	client?: AuditClient;
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

	const handleFilterSubmit = (event: FormEvent) => {
		event.preventDefault();
		void refresh();
	};

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Audit log</h1>

			<form style={styles.form} onSubmit={handleFilterSubmit}>
				<input
					style={styles.input}
					placeholder="Event type"
					value={type}
					onChange={(event) => setType(event.target.value)}
				/>
				<input
					style={styles.input}
					placeholder="Actor ID"
					value={actorId}
					onChange={(event) => setActorId(event.target.value)}
				/>
				<button type="submit" style={styles.filterButton}>
					Filter
				</button>
			</form>

			{error && (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			)}

			{isLoading ? (
				<p style={styles.status}>Loading…</p>
			) : (
				<ul style={styles.list}>
					{events.map((event) => (
						<li key={event.id} style={styles.row}>
							<button
								type="button"
								onClick={() => setExpanded(expanded === event.id ? null : event.id)}
								style={styles.rowButton}
							>
								<span style={styles.type}>{event.type}</span>
								<span style={styles.meta}>
									{event.actorId ?? 'system'} · {new Date(event.createdAt).toLocaleString()}
								</span>
							</button>
							{expanded === event.id && (
								<pre style={styles.payload}>{JSON.stringify(event.payload, null, 2)}</pre>
							)}
						</li>
					))}
				</ul>
			)}

			{hasMore && (
				<button
					type="button"
					disabled={isLoadingMore}
					onClick={loadMore}
					style={styles.loadMoreButton}
				>
					{isLoadingMore ? 'Loading…' : 'Load more'}
				</button>
			)}
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 640 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	form: { display: 'flex', gap: 8, marginBottom: 16 },
	input: { flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 14 },
	filterButton: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '0 16px',
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
		padding: '10px 0',
		background: 'none',
		border: 'none',
		cursor: 'pointer',
		textAlign: 'left',
	},
	type: { fontSize: 14, fontWeight: 600 },
	meta: { fontSize: 13, color: '#666' },
	payload: {
		background: '#f7f7f7',
		borderRadius: 8,
		padding: 12,
		fontSize: 12,
		fontFamily: 'monospace',
		overflowX: 'auto',
		marginBottom: 12,
	},
	loadMoreButton: {
		marginTop: 16,
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '10px 20px',
		fontSize: 14,
		cursor: 'pointer',
	},
};
