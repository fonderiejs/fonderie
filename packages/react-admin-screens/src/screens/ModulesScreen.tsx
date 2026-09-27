import { type AdminClient, type AdminLocale, createAdminT } from '@fonderie/client';
import { useManifest } from '@fonderie/react-admin';
import { styles } from '../styles';
import { PageHeader, Pill } from '../ui';

export interface IModulesScreenProps {
	client: AdminClient;
	locale?: AdminLocale | undefined;
}

// What is deployed: every module, its version, readiness, and whether it
// offers anything to this surface.
export function ModulesScreen({ client, locale }: IModulesScreenProps) {
	const t = createAdminT(locale);
	const { manifest, isLoading, error } = useManifest(client);
	return (
		<div style={styles.container}>
			<PageHeader
				title={t('modules.title')}
				lead={
					manifest
						? t('modules.leadSummary', {
								env: manifest.env,
								version: manifest.admin.version,
								log: manifest.admin.log ? t('modules.logOn') : t('modules.logOff'),
								routes: manifest.routes.length,
							})
						: t('modules.lead')
				}
			/>
			{isLoading ? (
				<p style={styles.status}>{t('common.loading')}</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : manifest ? (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>{t('modules.colModule')}</th>
							<th style={styles.th}>{t('modules.colVersion')}</th>
							<th style={styles.th}>{t('modules.colReadiness')}</th>
							<th style={styles.th}>{t('modules.colAdmin')}</th>
						</tr>
					</thead>
					<tbody>
						{manifest.modules.map((m) => (
							<tr key={m.name}>
								<td style={{ ...styles.td, ...styles.mono, fontWeight: 600 }}>{m.name}</td>
								<td style={{ ...styles.td, ...styles.mono }}>
									{m.version ?? <span style={styles.muted}>{t('modules.notReported')}</span>}
								</td>
								<td style={styles.td}>
									<Pill tone={m.readiness.ok ? 'ok' : 'bad'}>
										{m.readiness.ok ? t('common.status.ready') : t('common.status.error')}
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
										<span style={styles.badge}>{t('modules.describesAdmin')}</span>
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
