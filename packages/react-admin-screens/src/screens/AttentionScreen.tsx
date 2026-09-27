import type { AdminClient } from '@fonderie/client';
import { useAttention, useManifest } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill, RefreshButton, Stat } from '../ui';

export interface IAttentionScreenProps {
	client: AdminClient;
}

// What needs the operator today. Empty is green. The tiles above the list are
// the at-a-glance answer; the list is what to do about it.
export function AttentionScreen({ client }: IAttentionScreenProps) {
	const { attention, isLoading, error, refresh } = useAttention(client);
	const { manifest } = useManifest(client);
	const errors = attention?.items.filter((i) => i.severity === 'error') ?? [];
	const advice = attention?.items.filter((i) => i.severity !== 'error') ?? [];
	const ready = manifest?.modules.filter((m) => m.readiness.ok).length ?? 0;
	const total = manifest?.modules.length ?? 0;

	return (
		<div style={styles.container}>
			<PageHeader
				title="Attention"
				lead={
					attention
						? `What needs you on this deployment · checked ${new Date(attention.generatedAt).toLocaleTimeString()}`
						: 'What needs you on this deployment'
				}
				actions={<RefreshButton onClick={() => void refresh()} busy={isLoading} />}
			/>
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			<div style={styles.grid}>
				<Stat
					label="Needs action"
					value={attention ? errors.length : '—'}
					tone={errors.length ? 'bad' : attention ? 'ok' : undefined}
					hint="errors to fix"
				/>
				<Stat
					label="Advice"
					value={attention ? advice.length : '—'}
					tone={advice.length ? 'warn' : undefined}
					hint="worth a look"
				/>
				<Stat
					label="Modules ready"
					value={manifest ? `${ready}/${total}` : '—'}
					tone={manifest && ready < total ? 'warn' : manifest ? 'ok' : undefined}
					hint={manifest ? `admin ${manifest.admin.version}` : undefined}
				/>
				<Stat
					label="Routes"
					value={manifest ? manifest.routes.length : '—'}
					hint={manifest ? manifest.env : undefined}
				/>
			</div>
			{isLoading && !attention ? (
				<p style={styles.status}>Running the checks…</p>
			) : attention && attention.items.length === 0 ? (
				<Empty title="Nothing needs you">
					Every check passes. Checked {new Date(attention.generatedAt).toLocaleString()}.
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
										{item.severity === 'error' ? 'error' : 'advice'}
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
