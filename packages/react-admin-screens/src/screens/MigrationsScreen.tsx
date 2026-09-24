import type { AdminClient, IAdminMigrationModule } from '@fonderie/client';
import { useAdminMigrations } from '@fonderie/react-admin';
import { styles } from '../styles';

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
			<h1 style={styles.title}>Migrations</h1>

			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 403
						? 'Applying migrations needs a token with the write scope.'
						: error.explanation}
				</p>
			) : null}

			<p>
				<button type="button" style={styles.button} onClick={() => void refresh()} disabled={isLoading}>
					{isLoading ? 'Checking…' : 'Refresh'}
				</button>{' '}
				{report && !report.everApplied ? (
					<span style={styles.advice}>
						This database has never been migrated — treating it as a first install, so nothing is
						held back.
					</span>
				) : null}
			</p>

			{report && behind.length === 0 ? (
				<p style={styles.ok}>Every module is up to date.</p>
			) : null}

			{behind.map((m) => {
				const blocked = why(m, report?.everApplied ?? false);
				const files = m.pending.map((p) => p.file);
				return (
					<section key={m.name} style={{ marginBottom: 24 }}>
						<h2 style={styles.subtitle}>
							{m.name} — {m.pending.length} pending
						</h2>
						<ul>
							{m.pending.map((p) => (
								<li key={p.file}>
									<code>{p.file}</code>{' '}
									{p.impact === 'destructive' ? (
										<span style={styles.bad}>destructive</span>
									) : (
										<span style={styles.advice}>additive</span>
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
							<p style={styles.advice}>{blocked}</p>
						) : (
							<button
								type="button"
								style={styles.button}
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
