import { type AuthAdminClient, type BillingAdminClient, describeLocation } from '@fonderie/client';
import {
	useAdminLoginHistory,
	useAdminUser,
	useAdminUserSessions,
	useAdminUsers,
} from '@fonderie/react-admin';
import { useState } from 'react';
import { statusTone, useSubscriptionIndex } from '../billing';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill } from '../ui';
import { SubscriberBilling } from './SubscriberBilling';

export interface IUsersScreenProps {
	client: AuthAdminClient;
	pageSize?: number;
	// Given ⇒ a Plan column, and each user's plan, credits and grant form on
	// their page. Everyone has a wallet; no subscription means the free tier.
	billingClient?: BillingAdminClient | undefined;
	// Open this user on arrival (e.g. from the Subscriptions list).
	openUserId?: string | undefined;
}

// Who is signed up, and why can't this one log in. Lists on arrival — an
// operator who must know an address before they can see anything cannot find
// the account they are being asked about. Picking a row, or an exact email,
// opens the account: live sessions, recent sign-ins, suspend and sign-out.
export function UsersScreen({
	client,
	pageSize = 50,
	billingClient,
	openUserId,
}: IUsersScreenProps) {
	const [input, setInput] = useState('');
	const [selected, setSelected] = useState<{ id?: string; email?: string } | null>(
		openUserId ? { id: openUserId } : null,
	);
	const plans = useSubscriptionIndex(billingClient);

	const list = useAdminUsers(client, { limit: pageSize });
	const { user, isLoading, error, suspend, unsuspend, revokeSessions } = useAdminUser(
		client,
		selected ?? {},
	);
	const userId = user?.id ?? null;
	const sessions = useAdminUserSessions(client, userId);
	const history = useAdminLoginHistory(client, userId, { limit: 20 });

	const yesNo = (v: boolean) => (v ? <Pill tone="ok">yes</Pill> : <Pill tone="neutral">no</Pill>);

	const clear = () => {
		setSelected(null);
		setInput('');
	};

	return (
		<div style={styles.container}>
			<PageHeader
				title="Users"
				lead="Everyone signed up. Open an account for its sessions, sign-ins and the suspend and sign-out controls."
			/>
			<form
				style={styles.toolbar}
				onSubmit={(e) => {
					e.preventDefault();
					const email = input.trim();
					setSelected(email ? { email } : null);
				}}
			>
				<input
					type="email"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="email address"
					style={{ ...styles.input, minWidth: 280 }}
					aria-label="Email"
				/>
				<button type="submit" style={styles.buttonPrimary} disabled={isLoading}>
					<Icon name="search" size={14} />
					Look up
				</button>
				{selected ? (
					<button type="button" style={styles.buttonGhost} onClick={clear}>
						<Icon name="back" size={14} />
						All users
					</button>
				) : (
					<button
						type="button"
						style={styles.button}
						onClick={() => void list.refresh()}
						disabled={list.isLoading}
					>
						Refresh
					</button>
				)}
			</form>
			{error && !(error.status === 404 && selected?.id) ? (
				<p style={styles.error} role="alert">
					{error.status === 404 ? 'No user with that email.' : error.explanation}
				</p>
			) : null}
			{/* Opened by id (e.g. from Subscriptions) and the account is gone —
			    deleted or purged — while its billing rows remain. Say so, and
			    still show the money: a subscription and wallet outlive the
			    account row, and the operator came here to look at them. */}
			{error?.status === 404 && selected?.id ? (
				<>
					<div style={styles.notice} role="status">
						<strong>No account with id </strong>
						<code style={styles.code}>{selected.id}</code>
						<strong>.</strong> It was deleted, or never existed here. Its billing records remain.
					</div>
					{billingClient ? (
						<>
							<h2 style={styles.subtitle}>Plan &amp; credits</h2>
							<SubscriberBilling
								client={billingClient}
								subscriber={{ type: 'user', id: selected.id }}
							/>
						</>
					) : null}
				</>
			) : null}
			{!selected ? (
				<>
					{list.error ? (
						<p style={styles.error} role="alert">
							{list.error.explanation}
						</p>
					) : null}
					{list.users.length === 0 && !list.isLoading ? (
						<Empty icon="users" title="No users yet">
							Sign-ups appear here as they happen.
						</Empty>
					) : (
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>Email</th>
									<th style={styles.th}>Name</th>
									{billingClient ? <th style={styles.th}>Plan</th> : null}
									<th style={styles.th}>Created</th>
									<th style={styles.th}>Status</th>
								</tr>
							</thead>
							<tbody>
								{list.users.map((u) => (
									<tr key={u.id}>
										<td style={styles.td}>
											<button
												type="button"
												style={styles.link}
												onClick={() => setSelected({ id: u.id })}
											>
												{u.email}
											</button>
										</td>
										<td style={styles.td}>
											{`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || (
												<span style={styles.muted}>—</span>
											)}
										</td>
										{billingClient ? (
											<td style={styles.td}>
												{(() => {
													const sub = plans?.get(`user/${u.id}`);
													if (!plans) return <span style={styles.muted}>…</span>;
													if (!sub || sub.status === 'canceled')
														return <span style={styles.muted}>free</span>;
													return (
														<>
															<strong>{sub.plan}</strong>{' '}
															{sub.status !== 'active' ? (
																<Pill tone={statusTone(sub.status)}>{sub.status}</Pill>
															) : null}
														</>
													);
												})()}
											</td>
										) : null}
										<td style={styles.td}>{new Date(u.createdAt).toLocaleDateString()}</td>
										<td style={styles.td}>
											{u.suspended ? <Pill tone="warn">suspended</Pill> : null}
											{u.deletedAt ? <Pill tone="neutral">deleted</Pill> : null}
											{!u.suspended && !u.deletedAt ? <Pill tone="ok">active</Pill> : null}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
					{list.isLoading ? <p style={styles.status}>Loading…</p> : null}
					{list.hasMore && !list.isLoading ? (
						<button
							type="button"
							style={{ ...styles.button, marginTop: 8 }}
							onClick={() => void list.loadMore()}
						>
							Load more
						</button>
					) : null}
				</>
			) : null}
			{user ? (
				<>
					<h2 style={styles.subtitle}>
						{user.firstName || user.lastName
							? `${user.firstName} ${user.lastName}`.trim()
							: user.email}{' '}
						{user.suspended ? <Pill tone="warn">suspended</Pill> : null}
						{user.deletedAt ? <Pill tone="neutral">deleted</Pill> : null}
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
								style={styles.buttonDanger}
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

					{billingClient ? (
						<>
							<h2 style={styles.subtitle}>Plan &amp; credits</h2>
							<SubscriberBilling
								client={billingClient}
								subscriber={{ type: 'user', id: user.id }}
							/>
						</>
					) : null}

					<h2 style={styles.subtitle}>Live sessions</h2>
					{sessions.sessions.length === 0 ? (
						<p style={styles.muted}>None.</p>
					) : (
						<ul style={styles.list}>
							{sessions.sessions.map((s) => (
								<li key={s.id} style={styles.row}>
									<span style={styles.mono}>{s.ipAddress ?? '—'}</span>{' '}
									{describeLocation(s.location) ? (
										<span style={styles.muted}>{describeLocation(s.location)} </span>
									) : null}
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
									<Pill tone={e.outcome === 'success' ? 'ok' : 'bad'}>{e.outcome}</Pill>{' '}
									<span style={styles.muted}>{e.method}</span>{' '}
									<span style={styles.mono}>{e.ipAddress ?? '—'}</span>{' '}
									{describeLocation(e.location) ? (
										<span style={styles.muted}>{describeLocation(e.location)}</span>
									) : null}
									{e.location?.proxy || e.location?.hosting ? (
										<>
											{' '}
											<Pill tone="warn">{e.location.proxy ? 'proxy/VPN' : 'hosting'}</Pill>
										</>
									) : null}{' '}
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
