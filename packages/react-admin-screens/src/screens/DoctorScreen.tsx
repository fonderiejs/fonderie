import type { AdminClient } from '@fonderie/client';
import { useDoctor } from '@fonderie/react-admin';
import { styles } from '../styles';
import { PageHeader, Pill, RefreshButton } from '../ui';

export interface IDoctorScreenProps {
	client: AdminClient;
}

// Every reconciliation check, on demand. ok is false only for a hard failure;
// findings on a passing check are advice.
export function DoctorScreen({ client }: IDoctorScreenProps) {
	const { report, isLoading, error, refresh } = useDoctor(client);
	return (
		<div style={styles.container}>
			<PageHeader
				title="Doctor"
				lead="Every reconciliation check across the installed modules, run on demand."
				actions={
					<>
						{report && !isLoading ? (
							<Pill tone={report.ok ? 'ok' : 'bad'}>
								{report.ok ? 'all checks pass' : 'a check failed'}
							</Pill>
						) : null}
						<RefreshButton onClick={() => void refresh()} busy={isLoading} label="Run again" />
					</>
				}
			/>
			{isLoading && !report ? (
				<p style={styles.status}>Running the checks…</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={{ ...styles.th, width: 110 }}>Result</th>
							<th style={styles.th}>Check</th>
							<th style={{ ...styles.th, textAlign: 'right', width: 90 }}>Time</th>
						</tr>
					</thead>
					<tbody>
						{report?.checks.map((c) => (
							<tr key={c.name}>
								<td style={styles.td}>
									<Pill
										tone={
											c.skipped ? 'neutral' : c.ok ? (c.findings.length ? 'warn' : 'ok') : 'bad'
										}
									>
										{c.skipped
											? 'skipped'
											: c.ok
												? c.findings.length
													? 'advice'
													: 'ok'
												: 'failed'}
									</Pill>
								</td>
								<td style={styles.td}>
									<div>
										<span style={{ ...styles.mono, fontWeight: 600 }}>{c.name}</span>{' '}
										<span style={styles.muted}>{c.module}</span>
									</div>
									{c.skipped ? (
										<div style={{ ...styles.muted, marginTop: 4 }}>{c.skipped}</div>
									) : null}
									{c.findings.map((f) => (
										<div
											key={f}
											style={{
												marginTop: 4,
												fontSize: 13,
												lineHeight: 1.55,
												color: c.ok
													? 'var(--fonderie-text,#171717)'
													: 'var(--fonderie-danger,#e00)',
											}}
										>
											{f}
										</div>
									))}
								</td>
								<td
									style={{
										...styles.td,
										...styles.muted,
										textAlign: 'right',
										whiteSpace: 'nowrap',
									}}
								>
									{c.durationMs} ms
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
