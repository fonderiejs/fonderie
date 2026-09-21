import type { AdminClient } from '@fonderie/client';
import { useAdminTokens } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface ITokensScreenProps {
	client: AdminClient;
}

export function TokensScreen({ client }: ITokensScreenProps) {
	const { report, isLoading, error } = useAdminTokens(client);
	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Access</h1>
			{isLoading ? (
				<p style={styles.status}>Loading…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : report ? (
				<>
					<h2 style={styles.subtitle}>Admin token</h2>
					<p>
						{report.admin.ok ? (
							<span style={styles.ok}>strong</span>
						) : (
							<span style={styles.bad}>weak</span>
						)}
						{report.admin.problems.map((p) => (
							<div key={p.message} style={styles.bad}>
								{p.message}
							</div>
						))}
					</p>
					<h2 style={styles.subtitle}>Legacy per-brick tokens</h2>
					{report.legacy.length === 0 ? (
						<p style={styles.muted}>None — every brick's admin surface goes through this token.</p>
					) : (
						<ul style={styles.list}>
							{report.legacy.map((l) => (
								<li key={l.module} style={styles.row}>
									<span style={styles.mono}>{l.module}</span>{' '}
									<span style={styles.muted}>
										still registers its standalone routes with its own token (deprecated)
									</span>
								</li>
							))}
						</ul>
					)}
				</>
			) : null}
		</div>
	);
}
