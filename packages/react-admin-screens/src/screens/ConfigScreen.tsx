import type { AdminClient } from '@fonderie/client';
import { useAdminConfig } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface IConfigScreenProps {
	client: AdminClient;
}

// Declared vs held: readiness per module, and whether each environment
// variable the app reads is set. Values are never shown.
export function ConfigScreen({ client }: IConfigScreenProps) {
	const { report, isLoading, error } = useAdminConfig(client);
	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Configuration</h1>
			{isLoading ? (
				<p style={styles.status}>Loading…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : report ? (
				<>
					<h2 style={styles.subtitle}>Readiness</h2>
					<ul style={styles.list}>
						{report.modules.map((m) => (
							<li key={m.name} style={styles.row}>
								<span style={styles.mono}>{m.name}</span>{' '}
								{m.problems.length === 0 ? (
									<span style={styles.ok}>ok</span>
								) : (
									m.problems.map((p) => (
										<div
											key={p.message}
											style={p.severity === 'error' ? styles.bad : styles.advice}
										>
											{p.message}
										</div>
									))
								)}
							</li>
						))}
					</ul>
					<h2 style={styles.subtitle}>Environment</h2>
					{report.env.length === 0 ? (
						<p style={styles.muted}>No variables declared — pass `env` to AdminModule.</p>
					) : (
						<ul style={styles.list}>
							{report.env.map((e) => (
								<li key={e.name} style={styles.row}>
									<span style={styles.mono}>{e.name}</span>{' '}
									{e.set ? (
										<span style={styles.ok}>set</span>
									) : (
										<span style={styles.bad}>missing</span>
									)}
								</li>
							))}
						</ul>
					)}
				</>
			) : null}
		</div>
	);
}
