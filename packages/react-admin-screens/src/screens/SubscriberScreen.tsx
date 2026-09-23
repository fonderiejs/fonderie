import type { BillingAdminClient, SubscriberType } from '@fonderie/client';
import { useAdminSubscriber, useAdminSubscribers } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';

export interface ISubscriberScreenProps {
	client: BillingAdminClient;
	pageSize?: number;
}

// Who is subscribed, and then: what is this one on, what does their wallet
// hold, what moved — and the one write, a manual grant, idempotency-keyed.
// Lists on arrival; typing a type and an id was only possible if you already
// knew both, which is not how anyone arrives at this page.
export function SubscriberScreen({ client, pageSize = 50 }: ISubscriberScreenProps) {
	const [type, setType] = useState<SubscriberType>('user');
	const [idInput, setIdInput] = useState('');
	const [subscriber, setSubscriber] = useState<{ type: SubscriberType; id: string } | null>(null);
	const list = useAdminSubscribers(client, { limit: pageSize });
	const { subscription, wallet, ledger, hasMoreLedger, isLoading, error, loadMoreLedger, grant } =
		useAdminSubscriber(client, subscriber, { limit: 20 });
	const [amount, setAmount] = useState('');
	const [note, setNote] = useState('');
	const [granted, setGranted] = useState<string | null>(null);

	const open = (t: SubscriberType, id: string) => {
		setGranted(null);
		setType(t);
		setIdInput(id);
		setSubscriber({ type: t, id });
	};

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Subscriber</h1>
			<form
				style={styles.toolbar}
				onSubmit={(e) => {
					e.preventDefault();
					setGranted(null);
					setSubscriber(idInput.trim() ? { type, id: idInput.trim() } : null);
				}}
			>
				<select
					value={type}
					onChange={(e) => setType(e.target.value as SubscriberType)}
					style={styles.button}
					aria-label="Type"
				>
					<option value="user">user</option>
					<option value="workspace">workspace</option>
				</select>
				<input
					value={idInput}
					onChange={(e) => setIdInput(e.target.value)}
					placeholder="subscriber id"
					style={{ ...styles.button, cursor: 'text', minWidth: 280 }}
					aria-label="Subscriber id"
				/>
				<button type="submit" style={styles.button} disabled={isLoading}>
					Look up
				</button>
				{subscriber ? (
					<button
						type="button"
						style={styles.button}
						onClick={() => {
							setSubscriber(null);
							setIdInput('');
							setGranted(null);
						}}
					>
						← All subscribers
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
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			{!subscriber ? (
				<>
					{list.error ? (
						<p style={styles.error} role="alert">
							{list.error.explanation}
						</p>
					) : null}
					{list.subscriptions.length === 0 && !list.isLoading ? (
						<p style={styles.muted}>No subscribers yet.</p>
					) : (
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>Subscriber</th>
									<th style={styles.th}>Plan</th>
									<th style={styles.th}>Status</th>
									<th style={styles.th}>Renews</th>
								</tr>
							</thead>
							<tbody>
								{list.subscriptions.map((s) => (
									<tr key={s.id}>
										<td style={styles.td}>
											<button
												type="button"
												style={{ ...styles.navItem, padding: 0, ...styles.mono }}
												onClick={() => open(s.subscriberType, s.subscriberId)}
											>
												{s.subscriberType}/{s.subscriberId}
											</button>
										</td>
										<td style={styles.td}>
											<strong>{s.plan}</strong> · {s.interval}
										</td>
										<td style={styles.td}>
											{s.status}
											{s.cancelAtPeriodEnd ? <span style={styles.badge}>cancels</span> : null}
										</td>
										<td style={styles.td}>
											{s.currentPeriodEnd ? (
												new Date(s.currentPeriodEnd).toLocaleDateString()
											) : (
												<span style={styles.muted}>—</span>
											)}
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
			{subscriber && !isLoading ? (
				<>
					<h2 style={styles.subtitle}>Subscription</h2>
					{subscription ? (
						<table style={styles.table}>
							<tbody>
								<tr>
									<td style={styles.td}>plan</td>
									<td style={styles.td}>
										<strong>{subscription.plan}</strong> · {subscription.interval}
									</td>
								</tr>
								<tr>
									<td style={styles.td}>status</td>
									<td style={styles.td}>
										{subscription.status}
										{subscription.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
									</td>
								</tr>
								<tr>
									<td style={styles.td}>period</td>
									<td style={styles.td}>
										{subscription.currentPeriodStart
											? new Date(subscription.currentPeriodStart).toLocaleDateString()
											: '—'}{' '}
										→{' '}
										{subscription.currentPeriodEnd
											? new Date(subscription.currentPeriodEnd).toLocaleDateString()
											: '—'}
									</td>
								</tr>
								<tr>
									<td style={styles.td}>provider</td>
									<td style={{ ...styles.td, ...styles.mono }}>
										{subscription.providerSubscriptionId ?? '—'}
									</td>
								</tr>
							</tbody>
						</table>
					) : (
						<p style={styles.muted}>No subscription.</p>
					)}
					<h2 style={styles.subtitle}>Wallet</h2>
					{wallet ? (
						<>
							<p>
								<strong>{wallet.balance}</strong> {wallet.currency}{' '}
								<span style={styles.muted}>
									(granted {wallet.granted ?? '0'} · purchased {wallet.purchased ?? '0'}) · minor
									units, precision {wallet.precision}
								</span>
							</p>
							<form
								style={styles.toolbar}
								onSubmit={(e) => {
									e.preventDefault();
									const key = `admin-grant-${subscriber.type}-${subscriber.id}-${Date.now()}`;
									void grant({
										amount: amount.trim(),
										...(note ? { description: note } : {}),
										idempotencyKey: key,
									})
										.then(() => {
											setGranted(`Granted ${amount.trim()} ${wallet.currency}.`);
											setAmount('');
											setNote('');
										})
										.catch(() => {});
								}}
							>
								<input
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder="amount (minor units)"
									style={{ ...styles.button, cursor: 'text' }}
									aria-label="Amount"
								/>
								<input
									value={note}
									onChange={(e) => setNote(e.target.value)}
									placeholder="reason (optional)"
									style={{ ...styles.button, cursor: 'text', minWidth: 220 }}
									aria-label="Reason"
								/>
								<button type="submit" style={styles.button} disabled={!/^\d+$/.test(amount.trim())}>
									Grant
								</button>
								{granted ? <span style={styles.ok}>{granted}</span> : null}
							</form>
							<h2 style={styles.subtitle}>Ledger</h2>
							{ledger.length === 0 ? (
								<p style={styles.muted}>Nothing moved yet.</p>
							) : (
								<table style={styles.table}>
									<thead>
										<tr>
											<th style={styles.th}>When</th>
											<th style={styles.th}>Kind</th>
											<th style={styles.th}>Amount</th>
											<th style={styles.th}>Note</th>
										</tr>
									</thead>
									<tbody>
										{ledger.map((t) => (
											<tr key={t.id}>
												<td style={{ ...styles.td, ...styles.muted }}>
													{new Date(t.createdAt).toLocaleString()}
												</td>
												<td style={styles.td}>{t.type}</td>
												<td style={{ ...styles.td, ...styles.mono }}>{t.amount}</td>
												<td style={{ ...styles.td, ...styles.muted }}>{t.description ?? ''}</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
							{hasMoreLedger ? (
								<button
									type="button"
									style={{ ...styles.button, marginTop: 8 }}
									onClick={() => void loadMoreLedger()}
								>
									Load more
								</button>
							) : null}
						</>
					) : (
						<p style={styles.muted}>No wallet — billing has no wallet configuration.</p>
					)}
				</>
			) : null}
		</div>
	);
}
