import {
	type AdminClient,
	type AdminLocale,
	type AdminT,
	type IAdminMigrationModule,
	createAdminT,
} from '@fonderie/client';
import { useAdminMigrations } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, PageHeader, Pill, RefreshButton } from '../ui';

export interface IMigrationsScreenProps {
	client: AdminClient;
	locale?: AdminLocale | undefined;
}

// Why a module might not be appliable, in the operator's terms. Order matters:
// being blocked by an earlier module is the more actionable answer, so it is
// reported before the destructive one even when both are true.
function why(m: IAdminMigrationModule, everApplied: boolean, t: AdminT): string | null {
	if (m.pending.length === 0) return null;
	if (m.blockedBy) return t('migrations.blockedBy', { module: m.blockedBy });
	if (everApplied && m.pending.some((p) => p.impact === 'destructive'))
		return t('migrations.destructiveBlocked');
	return null;
}

export function MigrationsScreen({ client, locale }: IMigrationsScreenProps) {
	const t = createAdminT(locale);
	const { report, isLoading, error, refresh, apply } = useAdminMigrations(client);

	const behind = report?.modules.filter((m) => m.pending.length > 0) ?? [];

	return (
		<div style={styles.container}>
			<PageHeader
				title={t('migrations.title')}
				lead={t('migrations.lead')}
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
					{error.status === 403 ? t('migrations.needsWrite') : error.explanation}
				</p>
			) : null}

			{report && !report.everApplied ? (
				<p style={styles.notice}>{t('migrations.firstInstall')}</p>
			) : null}

			{report && behind.length === 0 ? (
				<Empty icon="migrations" title={t('migrations.upToDate')}>
					{t('migrations.noPending')}
				</Empty>
			) : null}

			{behind.map((m) => {
				const blocked = why(m, report?.everApplied ?? false, t);
				const files = m.pending.map((p) => p.file);
				return (
					<section key={m.name} style={{ ...styles.card, marginBottom: 16 }}>
						<h2 style={{ ...styles.subtitle, marginTop: 0 }}>
							<span style={styles.mono}>{m.name}</span>
							<Pill tone="warn">{t('migrations.pendingCount', { n: m.pending.length })}</Pill>
						</h2>
						<ul style={{ margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.9 }}>
							{m.pending.map((p) => (
								<li key={p.file}>
									<code style={styles.code}>{p.file}</code>{' '}
									{p.impact === 'destructive' ? (
										<Pill tone="bad">{t('migrations.destructive')}</Pill>
									) : (
										<Pill tone="neutral">{t('migrations.additive')}</Pill>
									)}
									{p.destructive.length > 0 ? (
										<ul>
											{p.destructive.map((s) => (
												<li key={s}>
													<code>{s.slice(0, 120)}</code>
												</li>
											))}
										</ul>
									) : null}
								</li>
							))}
						</ul>
						{blocked ? (
							<p style={{ ...styles.notice, marginBottom: 0 }}>{blocked}</p>
						) : (
							<button
								type="button"
								style={styles.buttonPrimary}
								disabled={isLoading || !m.appliable}
								onClick={() => {
									if (
										window.confirm(
											t('migrations.confirmApply', { n: m.pending.length, module: m.name }),
										)
									)
										// The hook already put any failure in `error` and re-read
										// the real state; nothing useful is left to do here.
										void apply(m.name, files).catch(() => {});
								}}
							>
								{m.pending.length === 1
									? t('migrations.applyOne')
									: t('migrations.applyMany', { n: m.pending.length })}
							</button>
						)}
					</section>
				);
			})}
		</div>
	);
}
