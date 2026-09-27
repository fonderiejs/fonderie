import type { BillingAdminClient, SubscriberType } from '@fonderie/client';
import { useAdminSubscriber } from '@fonderie/react-admin';
import { useState } from 'react';
import { periodEnd, statusTone } from '../billing';
import { styles } from '../styles';
import { Empty, Icon, Pill } from '../ui';

export interface ISubscriberBillingProps {
	client: BillingAdminClient;
	subscriber: { type: SubscriberType; id: string };
}

// "Permanent" is purchases plus admin grants — it never expires. "Plan
// allowance" is what the plan hands out each period, and can expire. The
// wallet API calls the second `granted` and the first `purchased`; an admin
// grant lands in the permanent part, which is why those names mislead here.
//
// One subscriber's money: plan, wallet, the one write (a grant,
// idempotency-keyed) and what moved. Used on a user's page and for workspace
// subscribers. A subscription is NOT required: everyone has a wallet, and a
// user with no subscription is on the free tier.
export function SubscriberBilling({ client, subscriber }: ISubscriberBillingProps) {
	// A wallet exists per currency. Empty ⇒ the billing default; typing another
	// (e.g. EUR) reads that wallet instead — same as the CLI's --currency.
	const [currency, setCurrency] = useState('');
	const [currencyDraft, setCurrencyDraft] = useState('');
	const { subscription, wallet, ledger, hasMoreLedger, isLoading, error, loadMoreLedger, grant } =
		useAdminSubscriber(client, subscriber, { limit: 20, ...(currency ? { currency } : {}) });
	const [amount, setAmount] = useState('');
	const [note, setNote] = useState('');
	const [granted, setGranted] = useState<string | null>(null);

	if (isLoading && !wallet && !subscription) return <p style={styles.status}>Loading billing…</p>;
	const end = subscription ? periodEnd(subscription) : null;

	return (
		<>
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			<div style={{ ...styles.grid, marginBottom: 16 }}>
				<div style={styles.card}>
					<div style={styles.statLabel}>Plan</div>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							marginTop: 6,
							flexWrap: 'wrap',
						}}
					>
						<strong style={{ fontSize: 18 }}>{subscription ? subscription.plan : 'Free'}</strong>
						{subscription ? (
							<>
								<span style={styles.muted}>· {subscription.interval}</span>
								<Pill tone={statusTone(subscription.status)}>{subscription.status}</Pill>
							</>
						) : (
							<span style={styles.muted}>no subscription</span>
						)}
					</div>
					{end ? (
						<div style={styles.statHint}>
							{end.label} {end.date}
						</div>
					) : null}
					{subscription?.providerSubscriptionId ? (
						<div style={{ ...styles.statHint, fontFamily: 'var(--fonderie-mono,monospace)' }}>
							{subscription.providerSubscriptionId}
						</div>
					) : null}
				</div>
				<div style={styles.card}>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							gap: 8,
						}}
					>
						<div style={styles.statLabel}>Credits</div>
						<form
							style={{ display: 'flex', gap: 4 }}
							onSubmit={(e) => {
								e.preventDefault();
								setCurrency(currencyDraft.trim().toUpperCase());
							}}
						>
							<input
								value={currencyDraft}
								onChange={(e) => setCurrencyDraft(e.target.value)}
								placeholder={wallet?.currency ?? 'currency'}
								maxLength={8}
								style={{ ...styles.input, height: 26, width: 84, fontSize: 12 }}
								aria-label="Wallet currency"
								title="Show the wallet in another currency"
							/>
						</form>
					</div>
					{wallet ? (
						<>
							<div style={styles.statValue}>
								{wallet.balance}{' '}
								<span style={{ fontSize: 14, fontWeight: 500 }}>{wallet.currency}</span>
							</div>
							<div style={styles.statHint}>
								{wallet.purchased ?? '0'} permanent · {wallet.granted ?? '0'} plan allowance
								{wallet.grantedExpiresAt
									? ` (expires ${new Date(wallet.grantedExpiresAt).toLocaleDateString()})`
									: ''}
							</div>
						</>
					) : (
						<div style={styles.statHint}>No wallet — billing has no wallet configuration.</div>
					)}
				</div>
			</div>

			{wallet ? (
				<form
					style={{
						...styles.card,
						display: 'flex',
						gap: 8,
						alignItems: 'center',
						flexWrap: 'wrap',
						marginBottom: 16,
					}}
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
					<strong style={{ fontSize: 13.5, marginRight: 4 }}>Grant credits</strong>
					<input
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						placeholder={`amount (${wallet.currency})`}
						inputMode="numeric"
						style={{ ...styles.input, width: 150 }}
						aria-label="Amount"
					/>
					<input
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder="reason (optional)"
						style={{ ...styles.input, flex: 1, minWidth: 180 }}
						aria-label="Reason"
					/>
					<button
						type="submit"
						style={styles.buttonPrimary}
						disabled={!/^\d+$/.test(amount.trim())}
					>
						<Icon name="plus" size={14} />
						Grant
					</button>
					{granted ? <span style={styles.ok}>{granted}</span> : null}
				</form>
			) : null}

			{wallet ? (
				ledger.length === 0 ? (
					<Empty icon="subscriber" title="No credit movements yet" />
				) : (
					<>
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
										<td style={{ ...styles.td, ...styles.muted, whiteSpace: 'nowrap' }}>
											{new Date(t.createdAt).toLocaleString()}
										</td>
										<td style={styles.td}>{t.type}</td>
										<td style={{ ...styles.td, ...styles.mono }}>{t.amount}</td>
										<td style={{ ...styles.td, ...styles.muted }}>{t.description ?? ''}</td>
									</tr>
								))}
							</tbody>
						</table>
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
				)
			) : null}
		</>
	);
}
