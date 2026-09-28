import { type AdminClient, type AdminLocale, createAdminT, localizeReason } from '@fonderie/client';
import { useAdminEnvironment } from '@fonderie/react-admin';
import { styles } from '../styles';
import { PageHeader, Pill } from '../ui';

export interface IEnvironmentScreenProps {
	client: AdminClient;
	locale?: AdminLocale | undefined;
}

// Declared vs held: readiness per module, and whether each environment
// variable the app reads is set. Values are never shown.
export function EnvironmentScreen({ client, locale }: IEnvironmentScreenProps) {
	const t = createAdminT(locale);
	const { report, isLoading, error } = useAdminEnvironment(client);
	const missing = report?.env.filter((e) => !e.set).length ?? 0;
	return (
		<div style={styles.container}>
			<PageHeader
				title={t('environment.title')}
				lead={t('environment.lead')}
				actions={
					report && report.env.length > 0 ? (
						<Pill tone={missing ? 'bad' : 'ok'}>
							{missing ? t('environment.missingCount', { n: missing }) : t('environment.allSet')}
						</Pill>
					) : null
				}
			/>
			{isLoading ? (
				<p style={styles.status}>{t('common.loading')}</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : report ? (
				<>
					<h2 style={{ ...styles.subtitle, marginTop: 0 }}>{t('environment.variables')}</h2>
					{report.env.length === 0 ? (
						<p style={styles.muted}>{t('environment.noVariables')}</p>
					) : (
						<div
							style={{
								...styles.grid,
								gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
								gap: 8,
							}}
						>
							{report.env.map((e) => (
								<div
									key={e.name}
									style={{
										...styles.card,
										padding: '10px 12px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: 8,
									}}
								>
									<span style={{ ...styles.mono, wordBreak: 'break-all' }}>{e.name}</span>
									<Pill tone={e.set ? 'ok' : 'bad'}>
										{e.set ? t('common.status.set') : t('common.status.missing')}
									</Pill>
								</div>
							))}
						</div>
					)}
					<h2 style={styles.subtitle}>{t('environment.moduleReadiness')}</h2>
					<ul style={styles.list}>
						{report.modules.map((m) => (
							<li key={m.name} style={styles.row}>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										gap: 12,
										alignItems: 'center',
									}}
								>
									<span style={{ ...styles.mono, fontWeight: 600 }}>{m.name}</span>
									<Pill
										tone={
											m.problems.length === 0
												? 'ok'
												: m.problems.some((p) => p.severity === 'error')
													? 'bad'
													: 'warn'
										}
									>
										{m.problems.length === 0
											? t('common.status.ready')
											: m.problems.length === 1
												? t('environment.problemOne')
												: t('environment.problemMany', { n: m.problems.length })}
									</Pill>
								</div>
								{m.problems.map((p) => (
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
										{localizeReason(p, locale)}
									</div>
								))}
							</li>
						))}
					</ul>
				</>
			) : null}
		</div>
	);
}
