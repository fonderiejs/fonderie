import type { AdminClient } from '@fonderie/client';
import { useAdminRoutes } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { MethodChip, PageHeader, Pill } from '../ui';

export interface IRoutesScreenProps {
	client: AdminClient;
}

// Every exposed route and what guards it. A hundred rows is normal, so the
// page filters as you type.
export function RoutesScreen({ client }: IRoutesScreenProps) {
	const { report, isLoading, error } = useAdminRoutes(client);
	const [q, setQ] = useState('');
	const needle = q.trim().toLowerCase();
	const routes = (report?.routes ?? []).filter(
		(r) =>
			!needle ||
			`${r.method} ${r.path} ${r.module ?? 'application'} ${r.guard}`
				.toLowerCase()
				.includes(needle),
	);
	return (
		<div style={styles.container}>
			<PageHeader
				title="Routes"
				lead={
					report
						? `${report.routes.length} routes exposed by this deployment, with the guard in front of each.`
						: 'Every exposed route, with its guard.'
				}
				actions={
					<input
						type="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Filter by path, method, module…"
						style={{ ...styles.input, width: 280 }}
						aria-label="Filter routes"
					/>
				}
			/>
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
							<th style={{ ...styles.th, width: 80 }}>Method</th>
							<th style={styles.th}>Path</th>
							<th style={styles.th}>Guard</th>
							<th style={styles.th}>Module</th>
						</tr>
					</thead>
					<tbody>
						{routes.map((r) => (
							<tr key={`${r.method} ${r.path}`}>
								<td style={styles.td}>
									<MethodChip method={r.method} />
								</td>
								<td style={{ ...styles.td, ...styles.mono, wordBreak: 'break-all' }}>{r.path}</td>
								<td style={styles.td}>
									<Pill
										tone={r.guard === 'admin' ? 'ok' : r.guard === 'probe' ? 'neutral' : 'info'}
										dot={false}
									>
										{r.guard}
									</Pill>
								</td>
								<td style={{ ...styles.td, ...styles.muted }}>{r.module ?? 'application'}</td>
							</tr>
						))}
						{routes.length === 0 ? (
							<tr>
								<td style={{ ...styles.td, ...styles.muted }} colSpan={4}>
									No route matches “{q}”.
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			)}
		</div>
	);
}
