import type { BillingAdminClient } from '@fonderie/client';
import { useAdminCatalog } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, PageHeader, RefreshButton } from '../ui';

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
			<PageHeader
				title="Catalog"
				lead="What you sell: plans as configured in code, and as stored in the database, side by side."
				actions={<RefreshButton onClick={() => void refresh()} busy={isLoading} />}
			/>
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			{isLoading && !catalog ? <p style={styles.status}>Loading…</p> : null}
			{catalog ? (
				<>
					<h2 style={{ ...styles.subtitle, marginTop: 0 }}>Configured (code)</h2>
					<pre
						style={{
							...styles.card,
							...styles.mono,
							margin: 0,
							overflowX: 'auto',
							maxHeight: 360,
							lineHeight: 1.6,
						}}
					>
						{JSON.stringify(catalog.configured, null, 2)}
					</pre>
					<h2 style={styles.subtitle}>Stored (database)</h2>
					{catalog.stored.length === 0 ? (
						<Empty icon="catalog" title="No stored plans">
							Plans are configured in code; nothing has been written to the database.
						</Empty>
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
												style={styles.buttonDanger}
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
