import type { AdminClient } from '@fonderie/client';
import { useManifest } from '@fonderie/react-admin';
import { styles } from '../styles';
import { PageHeader, Pill } from '../ui';

export interface IModulesScreenProps {
	client: AdminClient;
}

// What is deployed: every module, its version, readiness, and whether it
// offers anything to this surface.
export function ModulesScreen({ client }: IModulesScreenProps) {
	const { manifest, isLoading, error } = useManifest(client);
	return (
		<div style={styles.container}>
			<PageHeader
				title="Modules"
				lead={
					manifest
						? `${manifest.env} · admin ${manifest.admin.version} · admin log ${manifest.admin.log ? 'on' : 'off'} · ${manifest.routes.length} routes`
						: 'Every installed module, its version and whether it is ready.'
				}
			/>
			{isLoading ? (
				<p style={styles.status}>Loading…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : manifest ? (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>Module</th>
							<th style={styles.th}>Version</th>
							<th style={styles.th}>Readiness</th>
							<th style={styles.th}>Admin</th>
						</tr>
					</thead>
					<tbody>
						{manifest.modules.map((m) => (
							<tr key={m.name}>
								<td style={{ ...styles.td, ...styles.mono, fontWeight: 600 }}>{m.name}</td>
								<td style={{ ...styles.td, ...styles.mono }}>
									{m.version ?? <span style={styles.muted}>not reported</span>}
								</td>
								<td style={styles.td}>
									<Pill tone={m.readiness.ok ? 'ok' : 'bad'}>
										{m.readiness.ok ? 'ready' : 'error'}
									</Pill>
									{m.readiness.problems.map((p) => (
										<div
											key={p.message}
											style={{
												marginTop: 6,
												fontSize: 13,
												color:
													p.severity === 'error'
														? 'var(--fonderie-danger,#e00)'
														: 'var(--fonderie-text-muted,#5c5c5c)',
											}}
										>
											{p.message}
										</div>
									))}
								</td>
								<td style={styles.td}>
									{m.describesAdmin ? (
										<span style={styles.badge}>describes admin</span>
									) : (
										<span style={styles.muted}>—</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}
		</div>
	);
}
