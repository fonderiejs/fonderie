import type { AdminClient } from '@fonderie/client';
import { useAdminLog } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface IAdminLogScreenProps {
	client: AdminClient;
	pageSize?: number;
}

// Who did what through the surface, newest first — refused requests included.
export function AdminLogScreen({ client, pageSize = 50 }: IAdminLogScreenProps) {
	const { entries, hasMore, isLoading, error, refresh, loadMore } = useAdminLog(client, {
		limit: pageSize,
	});
	return (
		<div style={styles.container}>
			<div style={styles.toolbar}>
				<h1 style={{ ...styles.title, marginBottom: 0 }}>Admin log</h1>
				<button
					type="button"
					style={styles.button}
					onClick={() => void refresh()}
					disabled={isLoading}
				>
					Refresh
				</button>
			</div>
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 404
						? 'The admin log is off — give AdminModule a store.'
						: error.explanation}
				</p>
			) : (
				<>
					<table style={styles.table}>
						<thead>
							<tr>
								<th style={styles.th}>When</th>
								<th style={styles.th}>Actor</th>
								<th style={styles.th}>Request</th>
								<th style={styles.th}>Status</th>
								<th style={styles.th}>Module</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((e) => (
								<tr key={e.id}>
									<td style={{ ...styles.td, ...styles.muted }}>
										{new Date(e.at).toLocaleString()}
									</td>
									<td style={styles.td}>{e.actor}</td>
									<td style={{ ...styles.td, ...styles.mono }}>
										{e.method} {e.path}
									</td>
									<td style={styles.td}>
										<span style={e.status >= 400 ? styles.bad : styles.ok}>{e.status}</span>{' '}
										<span style={styles.muted}>{e.durationMs} ms</span>
									</td>
									<td style={{ ...styles.td, ...styles.muted }}>{e.module}</td>
								</tr>
							))}
						</tbody>
					</table>
					{isLoading ? <p style={styles.status}>Loading…</p> : null}
					{hasMore && !isLoading ? (
						<button
							type="button"
							style={{ ...styles.button, marginTop: 12 }}
							onClick={() => void loadMore()}
						>
							Load more
						</button>
					) : null}
				</>
			)}
		</div>
	);
}
