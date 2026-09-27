import type { AdminClient } from '@fonderie/client';
import { useAdminLog } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, MethodChip, PageHeader, Pill, RefreshButton } from '../ui';

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
			<PageHeader
				title="Admin log"
				lead="Every request made through this surface, newest first — refused ones included."
				actions={<RefreshButton onClick={() => void refresh()} busy={isLoading} />}
			/>
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 404
						? 'The admin log is off — give AdminModule a store.'
						: error.explanation}
				</p>
			) : entries.length === 0 && !isLoading ? (
				<Empty icon="log" title="No requests yet" />
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
									<td style={{ ...styles.td, ...styles.muted, whiteSpace: 'nowrap' }}>
										{new Date(e.at).toLocaleString()}
									</td>
									<td style={styles.td}>{e.actor}</td>
									<td style={styles.td}>
										<MethodChip method={e.method} />{' '}
										<span style={{ ...styles.mono, wordBreak: 'break-all' }}>{e.path}</span>
									</td>
									<td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
										<Pill tone={e.status >= 500 ? 'bad' : e.status >= 400 ? 'warn' : 'ok'}>
											{e.status}
										</Pill>{' '}
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
