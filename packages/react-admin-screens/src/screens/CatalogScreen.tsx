import { type AdminLocale, type BillingAdminClient, createAdminT } from '@fonderie/client';
import { useAdminCatalog } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, PageHeader, RefreshButton } from '../ui';

export interface ICatalogScreenProps {
	client: BillingAdminClient;
	locale?: AdminLocale | undefined;
}

// What am I selling: the plans as configured in code, and as stored in the
// database — side by side, so a divergence is visible. Report, do not repair.
export function CatalogScreen({ client, locale }: ICatalogScreenProps) {
	const t = createAdminT(locale);
	const { catalog, isLoading, error, refresh, deletePlan } = useAdminCatalog(client);
	const money = (v: number | null | undefined) => (v == null ? '—' : (v / 100).toFixed(2));
	return (
		<div style={styles.container}>
			<PageHeader
				title={t('catalog.title')}
				lead={t('catalog.lead')}
				actions={
					<RefreshButton
						onClick={() => void refresh()}
						busy={isLoading}
						label={t('common.refresh')}
					/>
				}
			/>
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			{isLoading && !catalog ? <p style={styles.status}>{t('common.loading')}</p> : null}
			{catalog ? (
				<>
					<h2 style={{ ...styles.subtitle, marginTop: 0 }}>{t('catalog.configured')}</h2>
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
					<h2 style={styles.subtitle}>{t('catalog.stored')}</h2>
					{catalog.stored.length === 0 ? (
						<Empty icon="catalog" title={t('catalog.emptyTitle')}>
							{t('catalog.emptyBody')}
						</Empty>
					) : (
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>{t('catalog.col.plan')}</th>
									<th style={styles.th}>{t('catalog.col.tier')}</th>
									<th style={styles.th}>{t('catalog.col.seats')}</th>
									<th style={styles.th}>{t('catalog.col.monthly')}</th>
									<th style={styles.th}>{t('catalog.col.yearly')}</th>
									<th style={styles.th}>{t('catalog.col.trial')}</th>
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
										<td style={styles.td}>
											{p.trialDays ? t('catalog.trialDays', { n: p.trialDays }) : '—'}
										</td>
										<td style={styles.td}>
											<button
												type="button"
												style={styles.buttonDanger}
												onClick={() => {
													if (window.confirm(t('catalog.deleteConfirm', { name: p.name })))
														void deletePlan(p.id).catch(() => {});
												}}
											>
												{t('common.delete')}
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
