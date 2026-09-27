import type { AdminClient, AdminScope, IAdminCreatedLink, IAdminOperator } from '@fonderie/client';
import { useAdminOperators } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill } from '../ui';

export interface IOperatorsScreenProps {
	client: AdminClient;
	// The signed-in operator's email: their own row offers no disable or
	// recovery (the server refuses both for yourself anyway).
	me?: string | undefined;
}

// Access levels as people think of them; scopes underneath.
const LEVELS: Array<{ label: string; scopes: AdminScope[]; hint: string }> = [
	{ label: 'Read only', scopes: ['read'], hint: 'look around, change nothing' },
	{ label: 'Editor', scopes: ['read', 'write'], hint: 'change config, templates, users' },
	{
		label: 'Owner',
		scopes: ['read', 'write', 'secrets'],
		hint: 'secrets, tokens and operators too',
	},
];
const levelOf = (scopes: readonly AdminScope[]) =>
	scopes.includes('secrets') ? 'Owner' : scopes.includes('write') ? 'Editor' : 'Read only';

function Minted({ link, onClose }: { link: IAdminCreatedLink; onClose: () => void }) {
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
			<strong>Send this link to {link.email}. It is shown once.</strong> It works once and expires{' '}
			{new Date(link.expiresAt).toLocaleString()}.
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
					{copied ? 'Copied' : 'Copy'}
				</button>
				<button type="button" style={styles.buttonGhost} onClick={onClose} aria-label="Dismiss">
					<Icon name="close" size={14} />
				</button>
			</div>
		</div>
	);
}

// The people who can sign in here. No registration: an owner invites, the
// invitee sets a password and an authenticator. Lost device or password → a
// recovery link from another owner.
export function OperatorsScreen({ client, me }: IOperatorsScreenProps) {
	const { report, isLoading, error, invite, recover, update, revokeLink } =
		useAdminOperators(client);
	const [email, setEmail] = useState('');
	const [level, setLevel] = useState('Editor');
	const [minted, setMinted] = useState<IAdminCreatedLink | null>(null);

	const scopesFor = (label: string) => LEVELS.find((l) => l.label === label)?.scopes ?? ['read'];
	const status = (o: IAdminOperator) =>
		o.disabledAt ? (
			<Pill tone="neutral">disabled</Pill>
		) : o.locked ? (
			<Pill tone="warn">locked</Pill>
		) : !o.enrolled ? (
			<Pill tone="warn">setting up</Pill>
		) : (
			<Pill tone="ok">active</Pill>
		);

	return (
		<div style={styles.container}>
			<PageHeader
				title="Operators"
				lead="The people who can sign in to this console. Each one uses a password and an authenticator app; there is no sign-up."
			/>
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 403 && error.reason === 'FORBIDDEN'
						? 'Managing operators needs the Owner level.'
						: error.explanation}
				</p>
			) : null}
			{minted ? <Minted link={minted} onClose={() => setMinted(null)} /> : null}

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
				<strong style={{ fontSize: 13.5, marginRight: 4 }}>Invite</strong>
				<input
					type="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="teammate@company.com"
					style={{ ...styles.input, flex: 1, minWidth: 220 }}
					aria-label="Email to invite"
				/>
				<select
					value={level}
					onChange={(e) => setLevel(e.target.value)}
					style={styles.input}
					aria-label="Access level"
				>
					{LEVELS.map((l) => (
						<option key={l.label} value={l.label}>
							{l.label} — {l.hint}
						</option>
					))}
				</select>
				<button type="submit" style={styles.buttonPrimary} disabled={!email.trim()}>
					<Icon name="plus" size={14} />
					Create invite link
				</button>
			</form>

			{isLoading && !report ? (
				<p style={styles.status}>Loading…</p>
			) : report && report.operators.length === 0 ? (
				<Empty icon="users" title="No operators yet" />
			) : report ? (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>Operator</th>
							<th style={styles.th}>Access</th>
							<th style={styles.th}>Status</th>
							<th style={styles.th}>Last sign-in</th>
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
										aria-label={`Access level for ${o.email}`}
									>
										{LEVELS.map((l) => (
											<option key={l.label} value={l.label}>
												{l.label}
											</option>
										))}
									</select>
								</td>
								<td style={styles.td}>
									{status(o)}
									{o.enrolled && o.backupCodesLeft <= 2 && !o.disabledAt ? (
										<div style={{ ...styles.muted, marginTop: 4 }}>
											{o.backupCodesLeft} backup code(s) left
										</div>
									) : null}
								</td>
								<td style={{ ...styles.td, ...styles.muted, whiteSpace: 'nowrap' }}>
									{o.lastLoginAt ? new Date(o.lastLoginAt).toLocaleString() : 'never'}
								</td>
								<td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
									{o.email === me ? (
										<span style={styles.muted}>you</span>
									) : (
										<>
											<button
												type="button"
												style={{ ...styles.button, height: 28, marginRight: 6 }}
												onClick={() => {
													if (
														window.confirm(
															`Create a recovery link for ${o.email}? It signs them out everywhere; the link sets a new password and a new authenticator.`,
														)
													)
														void recover(o.id)
															.then(setMinted)
															.catch(() => {});
												}}
											>
												Recovery link
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
														window.confirm(`Disable ${o.email}? They are signed out immediately.`)
													)
														void update(o.id, { disabled: !o.disabledAt }).catch(() => {});
												}}
											>
												{o.disabledAt ? 'Enable' : 'Disable'}
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
					<h2 style={styles.subtitle}>Pending links</h2>
					<ul style={styles.list}>
						{report.links.map((l) => (
							<li
								key={l.id}
								style={{ ...styles.row, display: 'flex', gap: 12, alignItems: 'center' }}
							>
								<Pill tone={l.kind === 'invite' ? 'info' : 'warn'} dot={false}>
									{l.kind}
								</Pill>
								<span style={{ flex: 1 }}>
									{l.email}
									{l.kind === 'invite' ? (
										<span style={styles.muted}> · {levelOf(l.scopes)}</span>
									) : null}
								</span>
								<span style={styles.muted}>expires {new Date(l.expiresAt).toLocaleString()}</span>
								<button
									type="button"
									style={{ ...styles.buttonDanger, height: 28 }}
									onClick={() => void revokeLink(l.id).catch(() => {})}
								>
									Revoke
								</button>
							</li>
						))}
					</ul>
				</>
			) : null}
		</div>
	);
}
