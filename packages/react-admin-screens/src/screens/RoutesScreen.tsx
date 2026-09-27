import { type AdminClient, type AdminLocale, createAdminT } from '@fonderie/client';
import { useAdminRoutes } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { MethodChip, PageHeader, Pill } from '../ui';

export interface IRoutesScreenProps {
	client: AdminClient;
	locale?: AdminLocale | undefined;
}

// Every exposed route and what guards it. A hundred rows is normal, so the
// page filters as you type.
export function RoutesScreen({ client, locale }: IRoutesScreenProps) {
	const t = createAdminT(locale);
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
				title={t('routes.title')}
				lead={report ? t('routes.leadCount', { n: report.routes.length }) : t('routes.lead')}
				actions={
					<input
						type="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={t('routes.filterPlaceholder')}
						style={{ ...styles.input, width: 280 }}
						aria-label={t('routes.filterLabel')}
					/>
				}
			/>
			{isLoading ? (
				<p style={styles.status}>{t('common.loading')}</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={{ ...styles.th, width: 80 }}>{t('routes.colMethod')}</th>
							<th style={styles.th}>{t('routes.colPath')}</th>
							<th style={styles.th}>{t('routes.colGuard')}</th>
							<th style={styles.th}>{t('routes.colModule')}</th>
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
								<td style={{ ...styles.td, ...styles.muted }}>
									{r.module ?? t('routes.application')}
								</td>
							</tr>
						))}
						{routes.length === 0 ? (
							<tr>
								<td style={{ ...styles.td, ...styles.muted }} colSpan={4}>
									{t('routes.noMatch', { q })}
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			)}
		</div>
	);
}
