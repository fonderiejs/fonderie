import { type AdminClient, type AdminLocale, createAdminT, localizeReason } from '@fonderie/client';
import { useDoctor } from '@fonderie/react-admin';
import { styles } from '../styles';
import { PageHeader, Pill, RefreshButton } from '../ui';

export interface IDoctorScreenProps {
	client: AdminClient;
	locale?: AdminLocale | undefined;
}

// Every reconciliation check, on demand. ok is false only for a hard failure;
// findings on a passing check are advice.
export function DoctorScreen({ client, locale }: IDoctorScreenProps) {
	const t = createAdminT(locale);
	const { report, isLoading, error, refresh } = useDoctor(client);
	return (
		<div style={styles.container}>
			<PageHeader
				title={t('doctor.title')}
				lead={t('doctor.lead')}
				actions={
					<>
						{report && !isLoading ? (
							<Pill tone={report.ok ? 'ok' : 'bad'}>
								{report.ok ? t('doctor.allPass') : t('doctor.oneFailed')}
							</Pill>
						) : null}
						<RefreshButton
							onClick={() => void refresh()}
							busy={isLoading}
							label={t('doctor.runAgain')}
							busyLabel={t('common.working')}
						/>
					</>
				}
			/>
			{isLoading && !report ? (
				<p style={styles.status}>{t('doctor.running')}</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={{ ...styles.th, width: 110 }}>{t('doctor.colResult')}</th>
							<th style={styles.th}>{t('doctor.colCheck')}</th>
							<th style={{ ...styles.th, textAlign: 'right', width: 90 }}>{t('doctor.colTime')}</th>
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
											? t('common.status.skipped')
											: c.ok
												? c.findings.length
													? t('common.status.advice')
													: t('common.status.ok')
												: t('common.status.failed')}
									</Pill>
								</td>
								<td style={styles.td}>
									<div>
										<span style={{ ...styles.mono, fontWeight: 600 }}>{c.name}</span>{' '}
										<span style={styles.muted}>{c.module}</span>
									</div>
									{c.skipped ? (
										<div style={{ ...styles.muted, marginTop: 4 }}>
											{localizeReason(c.skippedDetail ?? { message: c.skipped }, locale)}
										</div>
									) : null}
									{c.findings.map((f, i) => {
										// `details` runs parallel to `findings`; an older server sends only the strings.
										const detail = c.details?.[i];
										const error = detail ? detail.severity === 'error' : !c.ok;
										return (
											<div
												key={f}
												style={{
													marginTop: 4,
													fontSize: 13,
													lineHeight: 1.55,
													color: error
														? 'var(--fonderie-danger,#e00)'
														: 'var(--fonderie-text,#171717)',
												}}
											>
												{localizeReason(detail ?? { message: f }, locale)}
											</div>
										);
									})}
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
