import type { AuthAdminClient } from '@fonderie/client';
import { useAdminLoginHistory, useAdminUser, useAdminUserSessions } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';

export interface IUsersScreenProps {
	client: AuthAdminClient;
}

// Why can't this person log in. Look up by email, see the account, its live
// sessions and recent sign-ins; suspend, unsuspend, or sign them out everywhere.
export function UsersScreen({ client }: IUsersScreenProps) {
	const [input, setInput] = useState('');
	const [email, setEmail] = useState<string | undefined>(undefined);
	const { user, isLoading, error, suspend, unsuspend, revokeSessions } = useAdminUser(
		client,
		email ? { email } : {},
	);
	const userId = user?.id ?? null;
	const sessions = useAdminUserSessions(client, userId);
	const history = useAdminLoginHistory(client, userId, { limit: 20 });

	const yesNo = (v: boolean) =>
		v ? <span style={styles.ok}>yes</span> : <span style={styles.muted}>no</span>;

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Users</h1>
			<form
				style={styles.toolbar}
				onSubmit={(e) => {
					e.preventDefault();
					setEmail(input.trim() || undefined);
				}}
			>
				<input
					type="email"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="email address"
					style={{ ...styles.button, cursor: 'text', minWidth: 280 }}
					aria-label="Email"
				/>
				<button type="submit" style={styles.button} disabled={isLoading}>
					Look up
				</button>
			</form>
			{error ? (
				<p style={styles.error} role="alert">
					{error.status === 404 ? 'No user with that email.' : error.explanation}
				</p>
			) : null}
			{user ? (
				<>
					<h2 style={styles.subtitle}>
						{user.firstName || user.lastName
							? `${user.firstName} ${user.lastName}`.trim()
							: user.email}{' '}
						{user.suspended ? <span style={styles.badge}>suspended</span> : null}
						{user.deletedAt ? <span style={styles.badge}>deleted</span> : null}
					</h2>
					<table style={styles.table}>
						<tbody>
							<tr>
								<td style={styles.td}>id</td>
								<td style={{ ...styles.td, ...styles.mono }}>{user.id}</td>
							</tr>
							<tr>
								<td style={styles.td}>email</td>
								<td style={styles.td}>
									{user.email} · verified {yesNo(user.isEmailVerified)}
								</td>
							</tr>
							<tr>
								<td style={styles.td}>MFA</td>
								<td style={styles.td}>{yesNo(user.mfaEnabled)}</td>
							</tr>
							<tr>
								<td style={styles.td}>provider</td>
								<td style={styles.td}>
									{user.provider || 'password'}
									{user.hasPassword ? '' : ' · no password set'}
								</td>
							</tr>
							<tr>
								<td style={styles.td}>last login</td>
								<td style={styles.td}>
									{user.lastLogin ? (
										new Date(user.lastLogin).toLocaleString()
									) : (
										<span style={styles.muted}>never</span>
									)}
								</td>
							</tr>
							<tr>
								<td style={styles.td}>created</td>
								<td style={styles.td}>{new Date(user.createdAt).toLocaleString()}</td>
							</tr>
						</tbody>
					</table>
					<div style={{ ...styles.toolbar, marginTop: 12 }}>
						{user.suspended ? (
							<button
								type="button"
								style={styles.button}
								onClick={() => void unsuspend()}
								disabled={isLoading}
							>
								Unsuspend
							</button>
						) : (
							<button
								type="button"
								style={styles.button}
								onClick={() => void suspend()}
								disabled={isLoading}
							>
								Suspend
							</button>
						)}
						<button
							type="button"
							style={styles.button}
							onClick={() => void revokeSessions().then(() => sessions.refresh())}
							disabled={isLoading}
						>
							Sign out everywhere
						</button>
					</div>

					<h2 style={styles.subtitle}>Live sessions</h2>
					{sessions.sessions.length === 0 ? (
						<p style={styles.muted}>None.</p>
					) : (
						<ul style={styles.list}>
							{sessions.sessions.map((s) => (
								<li key={s.id} style={styles.row}>
									<span style={styles.mono}>{s.ipAddress ?? '—'}</span>{' '}
									<span style={styles.muted}>{s.userAgent ?? ''}</span>{' '}
									<span style={styles.muted}>since {new Date(s.createdAt).toLocaleString()}</span>
								</li>
							))}
						</ul>
					)}

					<h2 style={styles.subtitle}>Recent sign-ins</h2>
					{history.events.length === 0 && !history.isLoading ? (
						<p style={styles.muted}>None recorded.</p>
					) : (
						<ul style={styles.list}>
							{history.events.map((e) => (
								<li key={e.id} style={styles.row}>
									<span style={e.outcome === 'success' ? styles.ok : styles.bad}>{e.outcome}</span>{' '}
									<span style={styles.muted}>{e.method}</span>{' '}
									<span style={styles.muted}>{new Date(e.createdAt).toLocaleString()}</span>
								</li>
							))}
						</ul>
					)}
					{history.hasMore && !history.isLoading ? (
						<button
							type="button"
							style={{ ...styles.button, marginTop: 8 }}
							onClick={() => void history.loadMore()}
						>
							Load more
						</button>
					) : null}
				</>
			) : null}
		</div>
	);
}
