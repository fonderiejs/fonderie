import {
	type AdminClient,
	type AdminLocale,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAttention, useManifest } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill, RefreshButton, Stat } from '../ui';

export interface IAttentionScreenProps {
	client: AdminClient;
	locale?: AdminLocale | undefined;
}

// What needs the operator today. Empty is green. The tiles above the list are
// the at-a-glance answer; the list is what to do about it.
export function AttentionScreen({ client, locale }: IAttentionScreenProps) {
	const t = createAdminT(locale);
	const { attention, isLoading, error, refresh } = useAttention(client);
	const { manifest } = useManifest(client);
	const errors = attention?.items.filter((i) => i.severity === 'error') ?? [];
	const advice = attention?.items.filter((i) => i.severity !== 'error') ?? [];
	const ready = manifest?.modules.filter((m) => m.readiness.ok).length ?? 0;
	const total = manifest?.modules.length ?? 0;

	return (
		<div style={styles.container}>
			<PageHeader
				title={t('attention.title')}
				lead={
					attention
						? t('attention.leadChecked', {
								time: formatAdminDate(attention.generatedAt, locale, 'time'),
							})
						: t('attention.lead')
				}
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
					{error.explanation}
				</p>
			) : null}
			<div style={styles.grid}>
				<Stat
					label={t('attention.needsAction')}
					value={attention ? errors.length : '—'}
					tone={errors.length ? 'bad' : attention ? 'ok' : undefined}
					hint={t('attention.needsActionHint')}
				/>
				<Stat
					label={t('attention.advice')}
					value={attention ? advice.length : '—'}
					tone={advice.length ? 'warn' : undefined}
					hint={t('attention.adviceHint')}
				/>
				<Stat
					label={t('attention.modulesReady')}
					value={manifest ? `${ready}/${total}` : '—'}
					tone={manifest && ready < total ? 'warn' : manifest ? 'ok' : undefined}
					hint={
						manifest
							? t('attention.modulesReadyHint', { version: manifest.admin.version })
							: undefined
					}
				/>
				<Stat
					label={t('attention.routes')}
					value={manifest ? manifest.routes.length : '—'}
					hint={manifest ? manifest.env : undefined}
				/>
			</div>
			{isLoading && !attention ? (
				<p style={styles.status}>{t('attention.running')}</p>
			) : attention && attention.items.length === 0 ? (
				<Empty title={t('attention.emptyTitle')}>
					{t('attention.emptyBody', {
						time: formatAdminDate(attention.generatedAt, locale, 'datetime'),
					})}
				</Empty>
			) : (
				<ul style={styles.list}>
					{[...errors, ...advice].map((item) => (
						<li
							key={`${item.source}:${item.message}`}
							style={{ ...styles.row, display: 'flex', gap: 12, alignItems: 'flex-start' }}
						>
							<Icon
								name="alert"
								size={16}
								style={{
									marginTop: 3,
									color:
										item.severity === 'error'
											? 'var(--fonderie-danger,#e00)'
											: 'var(--fonderie-warning,#f5a623)',
								}}
							/>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div
									style={{
										display: 'flex',
										gap: 8,
										alignItems: 'center',
										flexWrap: 'wrap',
										marginBottom: 2,
									}}
								>
									<Pill tone={item.severity === 'error' ? 'bad' : 'warn'}>
										{item.severity === 'error'
											? t('common.status.error')
											: t('common.status.advice')}
									</Pill>
									<span style={styles.mono}>{item.source}</span>
								</div>
								<div style={{ lineHeight: 1.55 }}>{item.message}</div>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
