import {
	type AdminClient,
	type AdminLocale,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminLog } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, MethodChip, PageHeader, Pill, RefreshButton } from '../ui';

export interface IAdminLogScreenProps {
	client: AdminClient;
	pageSize?: number;
	locale?: AdminLocale | undefined;
}

// Who did what through the surface, newest first — refused requests included.
export function AdminLogScreen({ client, pageSize = 50, locale }: IAdminLogScreenProps) {
	const t = createAdminT(locale);
	const { entries, hasMore, isLoading, error, refresh, loadMore } = useAdminLog(client, {
		limit: pageSize,
	});
	return (
		<div style={styles.container}>
			<PageHeader
				title={t('log.title')}
				lead={t('log.lead')}
				actions={
					<RefreshButton
						onClick={() => void refresh()}
						busy={isLoading}
						label={t('common.refresh')}
						busyLabel={t('common.working')}
					/>
				}
			/>
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 404 ? t('log.off') : error.explanation}
				</p>
			) : entries.length === 0 && !isLoading ? (
				<Empty icon="log" title={t('log.empty')} />
			) : (
				<>
					<table style={styles.table}>
						<thead>
							<tr>
								<th style={styles.th}>{t('log.colWhen')}</th>
								<th style={styles.th}>{t('log.colActor')}</th>
								<th style={styles.th}>{t('log.colRequest')}</th>
								<th style={styles.th}>{t('log.colStatus')}</th>
								<th style={styles.th}>{t('log.colModule')}</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((e) => (
								<tr key={e.id}>
									<td style={{ ...styles.td, ...styles.muted, whiteSpace: 'nowrap' }}>
										{formatAdminDate(e.at, locale, 'datetime')}
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
					{isLoading ? <p style={styles.status}>{t('common.loading')}</p> : null}
					{hasMore && !isLoading ? (
						<button
							type="button"
							style={{ ...styles.button, marginTop: 12 }}
							onClick={() => void loadMore()}
						>
							{t('common.loadMore')}
						</button>
					) : null}
				</>
			)}
		</div>
	);
}
