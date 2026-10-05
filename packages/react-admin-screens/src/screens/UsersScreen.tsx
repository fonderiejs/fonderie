import {
	type AdminLocale,
	type AuthAdminClient,
	type BillingAdminClient,
	createAdminT,
	describeLocation,
	formatAdminDate,
} from '@fonderie/client';
import {
	useAdminLoginHistory,
	useAdminUser,
	useAdminUserSessions,
	useAdminUsers,
} from '@fonderie/react-admin';
import { useState } from 'react';
import { statusLabel, statusTone, useSubscriptionIndex } from '../billing';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill } from '../ui';
import { ErasuresPanel } from './ErasuresPanel';
import { SubscriberBilling } from './SubscriberBilling';

export interface IUsersScreenProps {
	client: AuthAdminClient;
	pageSize?: number;
	// Given ⇒ a Plan column, and each user's plan, credits and grant form on
	// their page. Everyone has a wallet; no subscription means the free tier.
	billingClient?: BillingAdminClient | undefined;
	// Open this user on arrival (e.g. from the Subscriptions list).
	openUserId?: string | undefined;
	locale?: AdminLocale | undefined;
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
	locale,
}: IUsersScreenProps) {
	const t = createAdminT(locale);
	const [input, setInput] = useState('');
	const [selected, setSelected] = useState<{ id?: string; email?: string } | null>(
		openUserId ? { id: openUserId } : null,
	);
	const plans = useSubscriptionIndex(billingClient);

	// Soft-deleted accounts are their own view: they cannot sign in and are
	// erased on their date, but until then an operator can see them, keep
	// them, hold them or erase them now. Erased accounts leave only receipts.
	const [view, setView] = useState<'active' | 'deleted' | 'erased'>('active');
	const showDeleted = view === 'deleted';
	const [erasureEmail, setErasureEmail] = useState<string | undefined>(undefined);
	const [holdReason, setHoldReason] = useState('');
	const [erasedNotice, setErasedNotice] = useState<string | null>(null);
	const list = useAdminUsers(client, {
		limit: pageSize,
		...(showDeleted ? { deleted: true } : {}),
	});
	const {
		user,
		isLoading,
		error,
		suspend,
		unsuspend,
		revokeSessions,
		cancelDeletion,
		holdDeletion,
		liftDeletionHold,
		eraseNow,
	} = useAdminUser(client, selected ?? {});
	const userId = user?.id ?? null;
	const sessions = useAdminUserSessions(client, userId);
	const history = useAdminLoginHistory(client, userId, { limit: 20 });

	const yesNo = (v: boolean) =>
		v ? <Pill tone="ok">{t('common.yes')}</Pill> : <Pill tone="neutral">{t('common.no')}</Pill>;

	const clear = () => {
		setSelected(null);
		setInput('');
	};

	return (
		<div style={styles.container}>
			<PageHeader title={t('users.title')} lead={t('users.lead')} />
			<form
				style={styles.toolbar}
				onSubmit={(e) => {
					e.preventDefault();
					const email = input.trim();
					setErasedNotice(null);
					if (view === 'erased') setErasureEmail(email || undefined);
					else setSelected(email ? { email } : null);
				}}
			>
				<input
					type="email"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={t('users.emailPlaceholder')}
					style={{ ...styles.input, minWidth: 280 }}
					aria-label={t('users.emailLabel')}
				/>
				<button type="submit" style={styles.buttonPrimary} disabled={isLoading}>
					<Icon name="search" size={14} />
					{t('common.lookUp')}
				</button>
				{selected ? (
					<button type="button" style={styles.buttonGhost} onClick={clear}>
						<Icon name="back" size={14} />
						{t('users.allUsers')}
					</button>
				) : (
					<button
						type="button"
						style={styles.button}
						onClick={() => void list.refresh()}
						disabled={list.isLoading}
					>
						{t('common.refresh')}
					</button>
				)}
				{!selected ? (
					<fieldset
						style={{
							display: 'flex',
							gap: 6,
							border: 'none',
							margin: '0 0 0 auto',
							padding: 0,
							minWidth: 0,
						}}
						aria-label={t('users.whichAccounts')}
					>
						{(['active', 'deleted', 'erased'] as const).map((v) => (
							<button
								key={v}
								type="button"
								aria-pressed={view === v}
								onClick={() => {
									setView(v);
									setErasureEmail(undefined);
								}}
								style={{
									...(view === v ? styles.buttonPrimary : styles.button),
									height: 28,
								}}
							>
								{v === 'active'
									? t('users.activeAccounts')
									: v === 'deleted'
										? t('users.deletedAccounts')
										: t('users.erasedAccounts')}
							</button>
						))}
					</fieldset>
				) : null}
			</form>
			{error && !(error.status === 404 && selected?.id) ? (
				<p style={styles.error} role="alert">
					{error.status === 404 ? t('users.noUserWithEmail') : error.explanation}
				</p>
			) : null}
			{/* Opened by id (e.g. from Subscriptions) and the account is gone —
			    deleted or purged — while its billing rows remain. Say so, and
			    still show the money: a subscription and wallet outlive the
			    account row, and the operator came here to look at them. */}
			{error?.status === 404 && selected?.id ? (
				<>
					<div style={styles.notice} role="status">
						<strong>{t('users.missingIdPrefix')} </strong>
						<code style={styles.code}>{selected.id}</code>
						<strong>.</strong> {t('users.missingIdBody')}
					</div>
					{billingClient ? (
						<>
							<h2 style={styles.subtitle}>{t('users.planCredits')}</h2>
							<SubscriberBilling
								client={billingClient}
								subscriber={{ type: 'user', id: selected.id }}
								locale={locale}
							/>
						</>
					) : null}
				</>
			) : null}
			{erasedNotice ? (
				<div style={styles.notice} role="status">
					{erasedNotice}
				</div>
			) : null}
			{!selected && view === 'erased' ? (
				<ErasuresPanel client={client} email={erasureEmail} pageSize={pageSize} locale={locale} />
			) : null}
			{!selected && view !== 'erased' ? (
				<>
					{list.error ? (
						<p style={styles.error} role="alert">
							{list.error.explanation}
						</p>
					) : null}
					{list.users.length === 0 && !list.isLoading ? (
						<Empty icon="users" title={t('users.emptyTitle')}>
							{t('users.emptyBody')}
						</Empty>
					) : (
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>{t('users.col.email')}</th>
									<th style={styles.th}>{t('users.col.name')}</th>
									{billingClient ? <th style={styles.th}>{t('users.col.plan')}</th> : null}
									<th style={styles.th}>{t('users.col.created')}</th>
									{showDeleted ? <th style={styles.th}>{t('users.deletion.deletesOn')}</th> : null}
									<th style={styles.th}>{t('users.col.status')}</th>
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
														return <span style={styles.muted}>{t('common.status.free')}</span>;
													return (
														<>
															<strong>{sub.plan}</strong>{' '}
															{sub.status !== 'active' ? (
																<Pill tone={statusTone(sub.status)}>
																	{statusLabel(t, sub.status)}
																</Pill>
															) : null}
														</>
													);
												})()}
											</td>
										) : null}
										<td style={styles.td}>{formatAdminDate(u.createdAt, locale, 'date')}</td>
										{showDeleted ? (
											<td style={styles.td}>
												{u.deletion ? formatAdminDate(u.deletion.deleteOn, locale, 'date') : '—'}
												{u.deletion?.hold ? (
													<>
														{' '}
														<Pill tone="warn">{t('users.deletion.held')}</Pill>
													</>
												) : null}
											</td>
										) : null}
										<td style={styles.td}>
											{u.suspended ? <Pill tone="warn">{t('common.status.suspended')}</Pill> : null}
											{u.deletedAt ? (
												<Pill tone="neutral">{t('common.status.deleted')}</Pill>
											) : null}
											{!u.suspended && !u.deletedAt ? (
												<Pill tone="ok">{t('common.status.active')}</Pill>
											) : null}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
					{list.isLoading ? <p style={styles.status}>{t('common.loading')}</p> : null}
					{list.hasMore && !list.isLoading ? (
						<button
							type="button"
							style={{ ...styles.button, marginTop: 8 }}
							onClick={() => void list.loadMore()}
						>
							{t('common.loadMore')}
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
						{user.suspended ? <Pill tone="warn">{t('common.status.suspended')}</Pill> : null}
						{user.deletedAt ? <Pill tone="neutral">{t('common.status.deleted')}</Pill> : null}
					</h2>
					<table style={styles.table}>
						<tbody>
							<tr>
								<td style={styles.td}>{t('users.field.id')}</td>
								<td style={{ ...styles.td, ...styles.mono }}>{user.id}</td>
							</tr>
							<tr>
								<td style={styles.td}>{t('users.field.email')}</td>
								<td style={styles.td}>
									{user.email} · {t('users.field.verified')} {yesNo(user.isEmailVerified)}
								</td>
							</tr>
							<tr>
								<td style={styles.td}>{t('users.field.mfa')}</td>
								<td style={styles.td}>{yesNo(user.mfaEnabled)}</td>
							</tr>
							<tr>
								<td style={styles.td}>{t('users.field.provider')}</td>
								<td style={styles.td}>
									{user.provider || t('users.passwordProvider')}
									{user.hasPassword ? '' : ` · ${t('users.noPasswordSet')}`}
								</td>
							</tr>
							<tr>
								<td style={styles.td}>{t('users.field.lastLogin')}</td>
								<td style={styles.td}>
									{user.lastLogin ? (
										formatAdminDate(user.lastLogin, locale)
									) : (
										<span style={styles.muted}>{t('common.never')}</span>
									)}
								</td>
							</tr>
							<tr>
								<td style={styles.td}>{t('users.field.created')}</td>
								<td style={styles.td}>{formatAdminDate(user.createdAt, locale)}</td>
							</tr>
						</tbody>
					</table>
					{user.deletedAt ? (
						<>
							<div style={{ ...styles.notice, marginTop: 12 }} role="status">
								<strong>
									{t('users.deletedOn', { date: formatAdminDate(user.deletedAt, locale) })}
								</strong>{' '}
								{t('users.deletedBody')}
							</div>
							{user.deletion ? (
								<>
									<h2 style={styles.subtitle}>
										{t('users.deletion.title')}{' '}
										{user.deletion.hold ? <Pill tone="warn">{t('users.deletion.held')}</Pill> : null}
									</h2>
									<table style={styles.table}>
										<tbody>
											<tr>
												<td style={styles.td}>{t('users.deletion.requested')}</td>
												<td style={styles.td}>{formatAdminDate(user.deletion.requestedAt, locale)}</td>
											</tr>
											<tr>
												<td style={styles.td}>{t('users.deletion.deletesOn')}</td>
												<td style={styles.td}>{formatAdminDate(user.deletion.deleteOn, locale, 'date')}</td>
											</tr>
											<tr>
												<td style={styles.td}>{t('users.deletion.channel')}</td>
												<td style={styles.td}>{user.deletion.channel ?? '—'}</td>
											</tr>
											<tr>
												<td style={styles.td}>{t('users.deletion.reminded')}</td>
												<td style={styles.td}>
													{user.deletion.remindedAt ? (
														formatAdminDate(user.deletion.remindedAt, locale)
													) : (
														<span style={styles.muted}>{t('users.deletion.notYet')}</span>
													)}
												</td>
											</tr>
										</tbody>
									</table>
									{user.deletion.hold ? (
										<div style={{ ...styles.notice, marginTop: 12 }} role="status">
											<strong>
												{t('users.deletion.heldSince', {
													date: formatAdminDate(user.deletion.hold.at, locale),
													reason: user.deletion.hold.reason ?? '—',
												})}
											</strong>{' '}
											{t('users.deletion.heldBody')}
										</div>
									) : null}
									<div style={{ ...styles.toolbar, marginTop: 12 }}>
										<button
											type="button"
											style={styles.button}
											disabled={isLoading}
											onClick={() => {
												if (window.confirm(t('users.deletion.cancelConfirm'))) void cancelDeletion();
											}}
										>
											{t('users.deletion.cancel')}
										</button>
										{user.deletion.hold ? (
											<button
												type="button"
												style={styles.button}
												disabled={isLoading}
												onClick={() => void liftDeletionHold()}
											>
												{t('users.deletion.liftHold')}
											</button>
										) : (
											<button
												type="button"
												style={styles.buttonDanger}
												disabled={isLoading}
												onClick={() => {
													if (!window.confirm(t('users.deletion.eraseConfirm'))) return;
													void eraseNow().then((receipt) => {
														if (!receipt) return;
														setErasedNotice(t('users.deletion.erased', { id: receipt.id }));
														setSelected(null);
														void list.refresh();
													});
												}}
											>
												{t('users.deletion.eraseNow')}
											</button>
										)}
									</div>
									{!user.deletion.hold ? (
										<form
											style={{ ...styles.toolbar, marginTop: 8 }}
											onSubmit={(e) => {
												e.preventDefault();
												const reason = holdReason.trim();
												if (reason) void holdDeletion(reason).then(() => setHoldReason(''));
											}}
										>
											<input
												value={holdReason}
												onChange={(e) => setHoldReason(e.target.value)}
												placeholder={t('users.deletion.holdReasonPlaceholder')}
												aria-label={t('users.deletion.holdReasonLabel')}
												maxLength={500}
												style={{ ...styles.input, minWidth: 280 }}
											/>
											<button type="submit" style={styles.button} disabled={isLoading || !holdReason.trim()}>
												{t('users.deletion.hold')}
											</button>
										</form>
									) : null}
								</>
							) : null}
						</>
					) : (
						<div style={{ ...styles.toolbar, marginTop: 12 }}>
							{user.suspended ? (
								<button
									type="button"
									style={styles.button}
									onClick={() => void unsuspend()}
									disabled={isLoading}
								>
									{t('users.unsuspend')}
								</button>
							) : (
								<button
									type="button"
									style={styles.buttonDanger}
									onClick={() => void suspend()}
									disabled={isLoading}
								>
									{t('users.suspend')}
								</button>
							)}
							<button
								type="button"
								style={styles.button}
								onClick={() => void revokeSessions().then(() => sessions.refresh())}
								disabled={isLoading}
							>
								{t('users.signOutEverywhere')}
							</button>
						</div>
					)}

					{billingClient ? (
						<>
							<h2 style={styles.subtitle}>{t('users.planCredits')}</h2>
							<SubscriberBilling
								client={billingClient}
								subscriber={{ type: 'user', id: user.id }}
								locale={locale}
							/>
						</>
					) : null}

					{!user.deletedAt ? (
						<>
							<h2 style={styles.subtitle}>{t('users.liveSessions')}</h2>
							{sessions.sessions.length === 0 ? (
								<p style={styles.muted}>{t('common.none')}</p>
							) : (
								<ul style={styles.list}>
									{sessions.sessions.map((s) => (
										<li key={s.id} style={styles.row}>
											<span style={styles.mono}>{s.ipAddress ?? '—'}</span>{' '}
											{describeLocation(s.location) ? (
												<span style={styles.muted}>{describeLocation(s.location)} </span>
											) : null}
											<span style={styles.muted}>{s.userAgent ?? ''}</span>{' '}
											<span style={styles.muted}>
												{t('users.since', { date: formatAdminDate(s.createdAt, locale) })}
											</span>
										</li>
									))}
								</ul>
							)}

							<h2 style={styles.subtitle}>{t('users.recentSignIns')}</h2>
							{history.events.length === 0 && !history.isLoading ? (
								<p style={styles.muted}>{t('users.noneRecorded')}</p>
							) : (
								<ul style={styles.list}>
									{history.events.map((e) => (
										<li key={e.id} style={styles.row}>
											<Pill tone={e.outcome === 'success' ? 'ok' : 'bad'}>
												{e.outcome === 'success'
													? t('users.outcome.success')
													: e.outcome === 'failure'
														? t('users.outcome.failure')
														: e.outcome}
											</Pill>{' '}
											<span style={styles.muted}>{e.method}</span>{' '}
											<span style={styles.mono}>{e.ipAddress ?? '—'}</span>{' '}
											{describeLocation(e.location) ? (
												<span style={styles.muted}>{describeLocation(e.location)}</span>
											) : null}
											{e.location?.proxy || e.location?.hosting ? (
												<>
													{' '}
													<Pill tone="warn">
														{e.location.proxy ? t('users.proxyVpn') : t('users.hosting')}
													</Pill>
												</>
											) : null}{' '}
											<span style={styles.muted}>{formatAdminDate(e.createdAt, locale)}</span>
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
									{t('common.loadMore')}
								</button>
							) : null}
						</>
					) : null}
				</>
			) : null}
		</div>
	);
}
