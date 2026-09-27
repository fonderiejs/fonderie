import {
	type AdminClient,
	type AdminLocale,
	type AdminScope,
	type AdminT,
	type IAdminCreatedLink,
	type IAdminOperator,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminOperators } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill } from '../ui';

export interface IOperatorsScreenProps {
	client: AdminClient;
	// The signed-in operator's email: their own row offers no disable or
	// recovery (the server refuses both for yourself anyway).
	me?: string | undefined;
	locale?: AdminLocale | undefined;
}

// Access levels as people think of them; scopes underneath.
type LevelId = 'read' | 'editor' | 'owner';
const LEVELS: Array<{ id: LevelId; scopes: AdminScope[] }> = [
	{ id: 'read', scopes: ['read'] },
	{ id: 'editor', scopes: ['read', 'write'] },
	{ id: 'owner', scopes: ['read', 'write', 'secrets'] },
];
const levelOf = (scopes: readonly AdminScope[]): LevelId =>
	scopes.includes('secrets') ? 'owner' : scopes.includes('write') ? 'editor' : 'read';

function Minted({
	link,
	onClose,
	t,
	locale,
}: {
	link: IAdminCreatedLink;
	onClose: () => void;
	t: AdminT;
	locale: AdminLocale | undefined;
}) {
	const [copied, setCopied] = useState(false);
	const url = `${window.location.origin}${link.url}`;
	return (
		<div
			style={{
				...styles.notice,
				background: 'color-mix(in srgb, var(--fonderie-accent,#00d294) 10%, transparent)',
				borderColor: 'color-mix(in srgb, var(--fonderie-accent,#00d294) 35%, transparent)',
			}}
		>
			<strong>{t('operators.mintedTitle', { email: link.email })}</strong>{' '}
			{t('operators.mintedBody', { date: formatAdminDate(link.expiresAt, locale) })}
			<div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
				<code style={{ ...styles.code, flex: 1, padding: '7px 10px', wordBreak: 'break-all' }}>
					{url}
				</code>
				<button
					type="button"
					style={styles.button}
					onClick={() => {
						void navigator.clipboard?.writeText(url);
						setCopied(true);
					}}
				>
					{copied ? t('common.copied') : t('common.copy')}
				</button>
				<button
					type="button"
					style={styles.buttonGhost}
					onClick={onClose}
					aria-label={t('common.dismiss')}
				>
					<Icon name="close" size={14} />
				</button>
			</div>
		</div>
	);
}

// The people who can sign in here. No registration: an owner invites, the
// invitee sets a password and an authenticator. Lost device or password → a
// recovery link from another owner.
export function OperatorsScreen({ client, me, locale }: IOperatorsScreenProps) {
	const t = createAdminT(locale);
	const { report, isLoading, error, invite, recover, update, revokeLink } =
		useAdminOperators(client);
	const [email, setEmail] = useState('');
	const [level, setLevel] = useState<LevelId>('editor');
	const [minted, setMinted] = useState<IAdminCreatedLink | null>(null);

	const scopesFor = (id: string) => LEVELS.find((l) => l.id === id)?.scopes ?? ['read'];
	const status = (o: IAdminOperator) =>
		o.disabledAt ? (
			<Pill tone="neutral">{t('common.status.disabled')}</Pill>
		) : o.locked ? (
			<Pill tone="warn">{t('common.status.locked')}</Pill>
		) : !o.enrolled ? (
			<Pill tone="warn">{t('operators.settingUp')}</Pill>
		) : (
			<Pill tone="ok">{t('common.status.active')}</Pill>
		);

	return (
		<div style={styles.container}>
			<PageHeader title={t('operators.title')} lead={t('operators.lead')} />
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 403 && error.reason === 'FORBIDDEN'
						? t('operators.needsOwner')
						: error.explanation}
				</p>
			) : null}
			{minted ? (
				<Minted link={minted} onClose={() => setMinted(null)} t={t} locale={locale} />
			) : null}

			<form
				style={{
					...styles.card,
					display: 'flex',
					gap: 8,
					alignItems: 'center',
					flexWrap: 'wrap',
					marginBottom: 20,
				}}
				onSubmit={(e) => {
					e.preventDefault();
					void invite({ email: email.trim(), scopes: scopesFor(level) })
						.then((l) => {
							setMinted(l);
							setEmail('');
						})
						.catch(() => {});
				}}
			>
				<Icon name="users" size={16} />
				<strong style={{ fontSize: 13.5, marginRight: 4 }}>{t('operators.invite')}</strong>
				<input
					type="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder={t('operators.invitePlaceholder')}
					style={{ ...styles.input, flex: 1, minWidth: 220 }}
					aria-label={t('operators.inviteLabel')}
				/>
				<select
					value={level}
					onChange={(e) => setLevel(e.target.value as LevelId)}
					style={styles.input}
					aria-label={t('operators.accessLevelLabel')}
				>
					{LEVELS.map((l) => (
						<option key={l.id} value={l.id}>
							{t(`operators.level.${l.id}`)} — {t(`operators.levelHint.${l.id}`)}
						</option>
					))}
				</select>
				<button type="submit" style={styles.buttonPrimary} disabled={!email.trim()}>
					<Icon name="plus" size={14} />
					{t('operators.createInvite')}
				</button>
			</form>

			{isLoading && !report ? (
				<p style={styles.status}>{t('common.loading')}</p>
			) : report && report.operators.length === 0 ? (
				<Empty icon="users" title={t('operators.emptyTitle')} />
			) : report ? (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>{t('operators.col.operator')}</th>
							<th style={styles.th}>{t('operators.col.access')}</th>
							<th style={styles.th}>{t('operators.col.status')}</th>
							<th style={styles.th}>{t('operators.col.lastSignIn')}</th>
							<th style={styles.th} />
						</tr>
					</thead>
					<tbody>
						{report.operators.map((o) => (
							<tr key={o.id}>
								<td style={styles.td}>
									<div style={{ fontWeight: 600 }}>{o.name || o.email}</div>
									{o.name ? <div style={styles.muted}>{o.email}</div> : null}
								</td>
								<td style={styles.td}>
									<select
										value={levelOf(o.scopes)}
										onChange={(e) =>
											void update(o.id, { scopes: scopesFor(e.target.value) }).catch(() => {})
										}
										style={{ ...styles.input, height: 28, fontSize: 12.5 }}
										disabled={o.email === me}
										aria-label={t('operators.accessLevelFor', { email: o.email })}
									>
										{LEVELS.map((l) => (
											<option key={l.id} value={l.id}>
												{t(`operators.level.${l.id}`)}
											</option>
										))}
									</select>
								</td>
								<td style={styles.td}>
									{status(o)}
									{o.enrolled && o.backupCodesLeft <= 2 && !o.disabledAt ? (
										<div style={{ ...styles.muted, marginTop: 4 }}>
											{t(
												o.backupCodesLeft === 1
													? 'operators.backupCodesLeftOne'
													: 'operators.backupCodesLeftMany',
												{ n: o.backupCodesLeft },
											)}
										</div>
									) : null}
								</td>
								<td style={{ ...styles.td, ...styles.muted, whiteSpace: 'nowrap' }}>
									{o.lastLoginAt ? formatAdminDate(o.lastLoginAt, locale) : t('common.never')}
								</td>
								<td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
									{o.email === me ? (
										<span style={styles.muted}>{t('common.you')}</span>
									) : (
										<>
											<button
												type="button"
												style={{ ...styles.button, height: 28, marginRight: 6 }}
												onClick={() => {
													if (window.confirm(t('operators.recoveryConfirm', { email: o.email })))
														void recover(o.id)
															.then(setMinted)
															.catch(() => {});
												}}
											>
												{t('operators.recoveryLink')}
											</button>
											<button
												type="button"
												style={{
													...(o.disabledAt ? styles.button : styles.buttonDanger),
													height: 28,
												}}
												onClick={() => {
													if (
														o.disabledAt ||
														window.confirm(t('operators.disableConfirm', { email: o.email }))
													)
														void update(o.id, { disabled: !o.disabledAt }).catch(() => {});
												}}
											>
												{o.disabledAt ? t('operators.enable') : t('operators.disable')}
											</button>
										</>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}

			{report && report.links.length > 0 ? (
				<>
					<h2 style={styles.subtitle}>{t('operators.pendingLinks')}</h2>
					<ul style={styles.list}>
						{report.links.map((l) => (
							<li
								key={l.id}
								style={{ ...styles.row, display: 'flex', gap: 12, alignItems: 'center' }}
							>
								<Pill tone={l.kind === 'invite' ? 'info' : 'warn'} dot={false}>
									{l.kind === 'invite'
										? t('operators.linkKind.invite')
										: t('operators.linkKind.recovery')}
								</Pill>
								<span style={{ flex: 1 }}>
									{l.email}
									{l.kind === 'invite' ? (
										<span style={styles.muted}> · {t(`operators.level.${levelOf(l.scopes)}`)}</span>
									) : null}
								</span>
								<span style={styles.muted}>
									{t('operators.expiresOn', { date: formatAdminDate(l.expiresAt, locale) })}
								</span>
								<button
									type="button"
									style={{ ...styles.buttonDanger, height: 28 }}
									onClick={() => void revokeLink(l.id).catch(() => {})}
								>
									{t('operators.revoke')}
								</button>
							</li>
						))}
					</ul>
				</>
			) : null}
		</div>
	);
}
