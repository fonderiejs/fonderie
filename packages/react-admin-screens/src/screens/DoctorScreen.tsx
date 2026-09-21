import type { AdminClient } from '@fonderie/client';
import { useDoctor } from '@fonderie/react-admin';
import { styles } from '../styles';

export interface IDoctorScreenProps {
	client: AdminClient;
}

// Every reconciliation check, on demand. ok is false only for a hard failure;
// findings on a passing check are advice.
export function DoctorScreen({ client }: IDoctorScreenProps) {
	const { report, isLoading, error, refresh } = useDoctor(client);
	return (
		<div style={styles.container}>
			<div style={styles.toolbar}>
				<h1 style={{ ...styles.title, marginBottom: 0 }}>Doctor</h1>
				<button
					type="button"
					style={styles.button}
					onClick={() => void refresh()}
					disabled={isLoading}
				>
					Run again
				</button>
				{report && !isLoading ? (
					<span style={report.ok ? styles.ok : styles.bad}>
						{report.ok ? 'all checks pass' : 'a check failed'}
					</span>
				) : null}
			</div>
			{isLoading && !report ? (
				<p style={styles.status}>Running the checks…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : (
				<ul style={styles.list}>
					{report?.checks.map((c) => (
						<li key={c.name} style={styles.row}>
							<span style={c.skipped ? styles.muted : c.ok ? styles.ok : styles.bad}>
								{c.skipped ? 'skipped' : c.ok ? 'ok' : 'failed'}
							</span>{' '}
							<span style={styles.mono}>{c.name}</span>{' '}
							<span style={styles.muted}>
								{c.module} · {c.durationMs} ms
							</span>
							{c.skipped ? <div style={styles.muted}>{c.skipped}</div> : null}
							{c.findings.map((f) => (
								<div key={f} style={c.ok ? styles.advice : styles.bad}>
									{f}
								</div>
							))}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
