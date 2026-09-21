import type { AdminClient } from '@fonderie/client';
import { useAdminRoutes } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface IRoutesScreenProps {
	client: AdminClient;
}

export function RoutesScreen({ client }: IRoutesScreenProps) {
	const { report, isLoading, error } = useAdminRoutes(client);
	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Routes</h1>
			{isLoading ? (
				<p style={styles.status}>Loading…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>Method</th>
							<th style={styles.th}>Path</th>
							<th style={styles.th}>Guard</th>
							<th style={styles.th}>Module</th>
						</tr>
					</thead>
					<tbody>
						{report?.routes.map((r) => (
							<tr key={`${r.method} ${r.path}`}>
								<td style={{ ...styles.td, ...styles.mono }}>{r.method}</td>
								<td style={{ ...styles.td, ...styles.mono }}>{r.path}</td>
								<td style={styles.td}>
									<span style={styles.badge}>{r.guard}</span>
								</td>
								<td style={{ ...styles.td, ...styles.muted }}>{r.module ?? 'application'}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
