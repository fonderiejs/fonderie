import type { AdminClient, IAdminMigrationModule } from '@fonderie/client';
import { useAdminMigrations } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, PageHeader, Pill, RefreshButton } from '../ui';

export interface IMigrationsScreenProps {
	client: AdminClient;
}

// Why a module might not be appliable, in the operator's terms. Order matters:
// being blocked by an earlier module is the more actionable answer, so it is
// reported before the destructive one even when both are true.
function why(m: IAdminMigrationModule, everApplied: boolean): string | null {
	if (m.pending.length === 0) return null;
	if (m.blockedBy) return `Apply "${m.blockedBy}" first — it runs before this one and is behind.`;
	if (everApplied && m.pending.some((p) => p.impact === 'destructive'))
		return 'Contains a migration that deletes data. No down-migration brings it back — apply this one through CI or `npm run migrate`.';
	return null;
}

export function MigrationsScreen({ client }: IMigrationsScreenProps) {
	const { report, isLoading, error, refresh, apply } = useAdminMigrations(client);

	const behind = report?.modules.filter((m) => m.pending.length > 0) ?? [];

	return (
		<div style={styles.container}>
			<PageHeader
				title="Migrations"
				lead="Schema changes each module ships, and whether this database has them."
				actions={<RefreshButton onClick={() => void refresh()} busy={isLoading} />}
			/>

			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 403
						? 'Applying migrations needs a token with the write scope.'
						: error.explanation}
				</p>
			) : null}

			{report && !report.everApplied ? (
				<p style={styles.notice}>
					This database has never been migrated — treating it as a first install, so nothing is held
					back.
				</p>
			) : null}

			{report && behind.length === 0 ? (
				<Empty icon="migrations" title="Every module is up to date">
					No pending migrations.
				</Empty>
			) : null}

			{behind.map((m) => {
				const blocked = why(m, report?.everApplied ?? false);
				const files = m.pending.map((p) => p.file);
				return (
					<section key={m.name} style={{ ...styles.card, marginBottom: 16 }}>
						<h2 style={{ ...styles.subtitle, marginTop: 0 }}>
							<span style={styles.mono}>{m.name}</span>
							<Pill tone="warn">{m.pending.length} pending</Pill>
						</h2>
						<ul style={{ margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.9 }}>
							{m.pending.map((p) => (
								<li key={p.file}>
									<code style={styles.code}>{p.file}</code>{' '}
									{p.impact === 'destructive' ? (
										<Pill tone="bad">destructive</Pill>
									) : (
										<Pill tone="neutral">additive</Pill>
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
											`Apply ${m.pending.length} migration(s) to "${m.name}"? This changes the database schema.`,
										)
									)
										// The hook already put any failure in `error` and re-read
										// the real state; nothing useful is left to do here.
										void apply(m.name, files).catch(() => {});
								}}
							>
								Apply {m.pending.length} migration{m.pending.length === 1 ? '' : 's'}
							</button>
						)}
					</section>
				);
			})}
		</div>
	);
}
