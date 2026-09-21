import type { AdminClient } from '@fonderie/client';
import { useManifest } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface IModulesScreenProps {
	client: AdminClient;
}

// What is deployed: every module, its version, readiness, and whether it
// offers anything to this surface.
export function ModulesScreen({ client }: IModulesScreenProps) {
	const { manifest, isLoading, error } = useManifest(client);
	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Modules</h1>
			{isLoading ? (
				<p style={styles.status}>Loading…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : manifest ? (
				<>
					<p style={styles.muted}>
						{manifest.env} · admin {manifest.admin.version} · admin log{' '}
						{manifest.admin.log ? 'on' : 'off'} · {manifest.routes.length} routes
					</p>
					<table style={styles.table}>
						<thead>
							<tr>
								<th style={styles.th}>Module</th>
								<th style={styles.th}>Version</th>
								<th style={styles.th}>Readiness</th>
								<th style={styles.th}>Describes admin</th>
							</tr>
						</thead>
						<tbody>
							{manifest.modules.map((m) => (
								<tr key={m.name}>
									<td style={{ ...styles.td, ...styles.mono }}>{m.name}</td>
									<td style={styles.td}>
										{m.version ?? <span style={styles.muted}>not reported</span>}
									</td>
									<td style={styles.td}>
										{m.readiness.ok ? (
											<span style={styles.ok}>ok</span>
										) : (
											<span style={styles.bad}>error</span>
										)}
										{m.readiness.problems.map((p) => (
											<div
												key={p.message}
												style={p.severity === 'error' ? styles.bad : styles.advice}
											>
												{p.message}
											</div>
										))}
									</td>
									<td style={styles.td}>
										{m.describesAdmin ? 'yes' : <span style={styles.muted}>no</span>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			) : null}
		</div>
	);
}
