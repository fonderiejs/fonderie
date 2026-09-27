import {
	type AdminClient,
	type AdminLocale,
	type AdminScope,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminTokens } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill } from '../ui';

export interface ITokensScreenProps {
	client: AdminClient;
	locale?: AdminLocale | undefined;
}

const ALL: AdminScope[] = ['read', 'write', 'secrets'];

// Who can be here. Issuing and revoking need the ROOT token — the one in the
// deployment's config; a scoped token gets 401 on these and the page says so.
export function TokensScreen({ client, locale }: ITokensScreenProps) {
	const t = createAdminT(locale);
	const { report, isLoading, error, issue, revoke } = useAdminTokens(client);
	const [name, setName] = useState('');
	const [scopes, setScopes] = useState<AdminScope[]>(['read']);
	const [days, setDays] = useState('');
	const [minted, setMinted] = useState<{ name: string; token: string } | null>(null);

	const toggle = (s: AdminScope) =>
		setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

	return (
		<div style={styles.container}>
			<PageHeader title={t('tokens.title')} lead={t('tokens.lead')} />
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 401 ? t('tokens.needsRoot') : error.explanation}
				</p>
			) : null}

			<h2 style={{ ...styles.subtitle, marginTop: 0 }}>{t('tokens.rootToken')}</h2>
			{report ? (
				<div style={{ ...styles.card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
					<Icon name="lock" size={18} style={{ marginTop: 2 }} />
					<div>
						<Pill tone={report.admin.ok ? 'ok' : 'bad'}>
							{report.admin.ok ? t('tokens.strong') : t('tokens.weak')}
						</Pill>
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

			<h2 style={styles.subtitle}>{t('tokens.issuedTokens')}</h2>
			{report?.issued === null ? (
				<p style={styles.muted}>{t('tokens.issuingOff')}</p>
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
							<strong>{t('tokens.copyNow')}</strong> ({minted.name})
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
							placeholder={t('tokens.namePlaceholder')}
							style={styles.input}
							aria-label={t('tokens.nameLabel')}
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
								{t(`tokens.scope.${s}`)}
							</label>
						))}
						<input
							value={days}
							onChange={(e) => setDays(e.target.value)}
							placeholder={t('tokens.daysPlaceholder')}
							style={{ ...styles.input, width: 140 }}
							aria-label={t('tokens.daysLabel')}
						/>
						<button
							type="submit"
							style={styles.buttonPrimary}
							disabled={!name.trim() || scopes.length === 0 || isLoading}
						>
							<Icon name="plus" size={14} />
							{t('tokens.issue')}
						</button>
					</form>
					{report?.issued && report.issued.length > 0 ? (
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>{t('tokens.col.name')}</th>
									<th style={styles.th}>{t('tokens.col.scopes')}</th>
									<th style={styles.th}>{t('tokens.col.created')}</th>
									<th style={styles.th}>{t('tokens.col.expires')}</th>
									<th style={styles.th}>{t('tokens.col.lastUsed')}</th>
									<th style={styles.th} />
								</tr>
							</thead>
							<tbody>
								{report.issued.map((tk) => (
									<tr key={tk.id}>
										<td style={styles.td}>
											{tk.name}
											{tk.revokedAt ? (
												<>
													{' '}
													<Pill tone="neutral">{t('tokens.revoked')}</Pill>
												</>
											) : null}
										</td>
										<td style={{ ...styles.td, ...styles.mono }}>
											{tk.scopes.map((s) => t(`tokens.scope.${s}`)).join(', ')}
										</td>
										<td style={{ ...styles.td, ...styles.muted }}>
											{formatAdminDate(tk.createdAt, locale, 'date')} · {tk.createdBy}
										</td>
										<td style={{ ...styles.td, ...styles.muted }}>
											{tk.expiresAt
												? formatAdminDate(tk.expiresAt, locale, 'date')
												: t('common.never')}
										</td>
										<td style={{ ...styles.td, ...styles.muted }}>
											{tk.lastUsedAt ? formatAdminDate(tk.lastUsedAt, locale) : t('common.never')}
										</td>
										<td style={styles.td}>
											{tk.revokedAt ? null : (
												<button
													type="button"
													style={styles.buttonDanger}
													onClick={() => {
														if (window.confirm(t('tokens.revokeConfirm', { name: tk.name })))
															void revoke(tk.id).catch(() => {});
													}}
												>
													{t('tokens.revoke')}
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<Empty icon="tokens" title={t('tokens.emptyTitle')}>
							{t('tokens.emptyBody')}
						</Empty>
					)}
				</>
			)}

			<h2 style={styles.subtitle}>{t('tokens.legacyTitle')}</h2>
			{report && report.legacy.length === 0 ? (
				<p style={styles.muted}>{t('tokens.legacyNone')}</p>
			) : (
				<ul style={styles.list}>
					{report?.legacy.map((l) => (
						<li key={l.module} style={styles.row}>
							<span style={styles.mono}>{l.module}</span>{' '}
							<span style={styles.muted}>{t('tokens.legacyRow')}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
