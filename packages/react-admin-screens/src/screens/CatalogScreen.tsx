import type { BillingAdminClient } from '@fonderie/client';
import { useAdminCatalog } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface ICatalogScreenProps {
	client: BillingAdminClient;
}

// What am I selling: the plans as configured in code, and as stored in the
// database — side by side, so a divergence is visible. Report, do not repair.
export function CatalogScreen({ client }: ICatalogScreenProps) {
	const { catalog, isLoading, error, refresh, deletePlan } = useAdminCatalog(client);
	const money = (v: number | null | undefined) => (v == null ? '—' : (v / 100).toFixed(2));
	return (
		<div style={styles.container}>
			<div style={styles.toolbar}>
				<h1 style={{ ...styles.title, marginBottom: 0 }}>Catalog</h1>
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
					{error.explanation}
				</p>
			) : null}
			{isLoading && !catalog ? <p style={styles.status}>Loading…</p> : null}
			{catalog ? (
				<>
					<h2 style={styles.subtitle}>Configured (code)</h2>
					<pre style={{ ...styles.mono, background: 'var(--fonderie-surface-alt,#fafafa)', padding: 12, overflowX: 'auto' }}>
						{JSON.stringify(catalog.configured, null, 2)}
					</pre>
					<h2 style={styles.subtitle}>Stored (database)</h2>
					{catalog.stored.length === 0 ? (
						<p style={styles.muted}>No stored plans.</p>
					) : (
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>Plan</th>
									<th style={styles.th}>Tier</th>
									<th style={styles.th}>Seats</th>
									<th style={styles.th}>Monthly</th>
									<th style={styles.th}>Yearly</th>
									<th style={styles.th}>Trial</th>
									<th style={styles.th} />
								</tr>
							</thead>
							<tbody>
								{catalog.stored.map((p) => (
									<tr key={p.id}>
										<td style={styles.td}>
											<strong>{p.name}</strong>
											{p.description ? <div style={styles.muted}>{p.description}</div> : null}
										</td>
										<td style={styles.td}>{p.tier}</td>
										<td style={styles.td}>{p.seats ?? '∞'}</td>
										<td style={styles.td}>
											{money(p.pricing?.monthly)} {p.pricing?.currency ?? ''}
										</td>
										<td style={styles.td}>{money(p.pricing?.yearly)}</td>
										<td style={styles.td}>{p.trialDays ? `${p.trialDays} d` : '—'}</td>
										<td style={styles.td}>
											<button
												type="button"
												style={styles.button}
												onClick={() => {
													if (window.confirm(`Delete stored plan "${p.name}"?`))
														void deletePlan(p.id).catch(() => {});
												}}
											>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</>
			) : null}
		</div>
	);
}
