import type { AdminClient, AdminScope } from '@fonderie/client';
import { useAdminTokens } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill } from '../ui';

export interface ITokensScreenProps {
	client: AdminClient;
}

const ALL: AdminScope[] = ['read', 'write', 'secrets'];

// Who can be here. Issuing and revoking need the ROOT token — the one in the
// deployment's config; a scoped token gets 401 on these and the page says so.
export function TokensScreen({ client }: ITokensScreenProps) {
	const { report, isLoading, error, issue, revoke } = useAdminTokens(client);
	const [name, setName] = useState('');
	const [scopes, setScopes] = useState<AdminScope[]>(['read']);
	const [days, setDays] = useState('');
	const [minted, setMinted] = useState<{ name: string; token: string } | null>(null);

	const toggle = (s: AdminScope) =>
		setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

	return (
		<div style={styles.container}>
			<PageHeader
				title="Tokens"
				lead="Credentials for machines: the root token's strength, scoped tokens for the CLI and CI, and any legacy per-module tokens. People sign in as operators."
			/>
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 401
						? 'Issuing and revoking need the root token (the one in your deployment config).'
						: error.explanation}
				</p>
			) : null}

			<h2 style={{ ...styles.subtitle, marginTop: 0 }}>Root token</h2>
			{report ? (
				<div style={{ ...styles.card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
					<Icon name="lock" size={18} style={{ marginTop: 2 }} />
					<div>
						<Pill tone={report.admin.ok ? 'ok' : 'bad'}>{report.admin.ok ? 'strong' : 'weak'}</Pill>
						{report.admin.problems.map((p) => (
							<div
								key={p.message}
								style={{ marginTop: 6, color: 'var(--fonderie-danger,#e00)', fontSize: 13 }}
							>
								{p.message}
							</div>
						))}
					</div>
				</div>
			) : null}

			<h2 style={styles.subtitle}>Issued tokens</h2>
			{report?.issued === null ? (
				<p style={styles.muted}>
					Issuing is off — give AdminModule a store and run its migrations.
				</p>
			) : (
				<>
					{minted ? (
						<div
							style={{
								...styles.notice,
								background: 'color-mix(in srgb, var(--fonderie-accent,#00d294) 10%, transparent)',
								borderColor: 'color-mix(in srgb, var(--fonderie-accent,#00d294) 35%, transparent)',
							}}
						>
							<strong>Copy this now — it is never shown again.</strong> ({minted.name})
							<div
								style={{
									...styles.code,
									display: 'block',
									marginTop: 8,
									padding: '8px 10px',
									wordBreak: 'break-all',
								}}
							>
								{minted.token}
							</div>
						</div>
					) : null}
					<form
						style={styles.toolbar}
						onSubmit={(e) => {
							e.preventDefault();
							const d = Number(days);
							void issue({
								name: name.trim(),
								scopes,
								...(days && Number.isInteger(d) && d > 0 ? { expiresInDays: d } : {}),
							})
								.then((t) => {
									setMinted({ name: t.name, token: t.token });
									setName('');
									setDays('');
								})
								.catch(() => {});
						}}
					>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="name"
							style={styles.input}
							aria-label="Name"
						/>
						{ALL.map((s) => (
							<label
								key={s}
								style={{
									...styles.badge,
									cursor: 'pointer',
									height: 32,
									boxSizing: 'border-box',
									padding: '0 10px',
									fontSize: 13,
								}}
							>
								<input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} />{' '}
								{s}
							</label>
						))}
						<input
							value={days}
							onChange={(e) => setDays(e.target.value)}
							placeholder="days (optional)"
							style={{ ...styles.input, width: 140 }}
							aria-label="Days"
						/>
						<button
							type="submit"
							style={styles.buttonPrimary}
							disabled={!name.trim() || scopes.length === 0 || isLoading}
						>
							<Icon name="plus" size={14} />
							Issue token
						</button>
					</form>
					{report?.issued && report.issued.length > 0 ? (
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>Name</th>
									<th style={styles.th}>Scopes</th>
									<th style={styles.th}>Created</th>
									<th style={styles.th}>Expires</th>
									<th style={styles.th}>Last used</th>
									<th style={styles.th} />
								</tr>
							</thead>
							<tbody>
								{report.issued.map((t) => (
									<tr key={t.id}>
										<td style={styles.td}>
											{t.name}
											{t.revokedAt ? (
												<>
													{' '}
													<Pill tone="neutral">revoked</Pill>
												</>
											) : null}
										</td>
										<td style={{ ...styles.td, ...styles.mono }}>{t.scopes.join(', ')}</td>
										<td style={{ ...styles.td, ...styles.muted }}>
											{new Date(t.createdAt).toLocaleDateString()} · {t.createdBy}
										</td>
										<td style={{ ...styles.td, ...styles.muted }}>
											{t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'never'}
										</td>
										<td style={{ ...styles.td, ...styles.muted }}>
											{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : 'never'}
										</td>
										<td style={styles.td}>
											{t.revokedAt ? null : (
												<button
													type="button"
													style={styles.buttonDanger}
													onClick={() => {
														if (
															window.confirm(
																`Revoke "${t.name}"? Anything using it stops working immediately.`,
															)
														)
															void revoke(t.id).catch(() => {});
													}}
												>
													Revoke
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<Empty icon="tokens" title="No scoped tokens yet">
							Issue a read-only token for a dashboard or a teammate instead of sharing the root.
						</Empty>
					)}
				</>
			)}

			<h2 style={styles.subtitle}>Legacy per-brick tokens</h2>
			{report && report.legacy.length === 0 ? (
				<p style={styles.muted}>None — every brick's admin surface goes through this token.</p>
			) : (
				<ul style={styles.list}>
					{report?.legacy.map((l) => (
						<li key={l.module} style={styles.row}>
							<span style={styles.mono}>{l.module}</span>{' '}
							<span style={styles.muted}>
								still registers its standalone routes with its own token (deprecated)
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
