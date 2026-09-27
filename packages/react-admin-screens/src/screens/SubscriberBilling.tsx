import {
	type AdminLocale,
	type BillingAdminClient,
	type SubscriberType,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminSubscriber } from '@fonderie/react-admin';
import { useState } from 'react';
import { intervalLabel, periodEnd, statusLabel, statusTone } from '../billing';
import { styles } from '../styles';
import { Empty, Icon, Pill } from '../ui';

export interface ISubscriberBillingProps {
	client: BillingAdminClient;
	subscriber: { type: SubscriberType; id: string };
	locale?: AdminLocale | undefined;
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
export function SubscriberBilling({ client, subscriber, locale }: ISubscriberBillingProps) {
	const t = createAdminT(locale);
	const LEDGER_KINDS = ['purchase', 'grant', 'usage', 'refund', 'adjustment', 'expiry'] as const;
	const ledgerKind = (kind: string) =>
		(LEDGER_KINDS as readonly string[]).includes(kind)
			? t(`billing.ledgerKind.${kind as (typeof LEDGER_KINDS)[number]}`)
			: kind;
	// A wallet exists per currency. Empty ⇒ the billing default; typing another
	// (e.g. EUR) reads that wallet instead — same as the CLI's --currency.
	const [currency, setCurrency] = useState('');
	const [currencyDraft, setCurrencyDraft] = useState('');
	const { subscription, wallet, ledger, hasMoreLedger, isLoading, error, loadMoreLedger, grant } =
		useAdminSubscriber(client, subscriber, { limit: 20, ...(currency ? { currency } : {}) });
	const [amount, setAmount] = useState('');
	const [note, setNote] = useState('');
	const [granted, setGranted] = useState<string | null>(null);

	if (isLoading && !wallet && !subscription)
		return <p style={styles.status}>{t('billing.loading')}</p>;
	const end = subscription ? periodEnd(subscription, locale) : null;

	return (
		<>
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			<div style={{ ...styles.grid, marginBottom: 16 }}>
				<div style={styles.card}>
					<div style={styles.statLabel}>{t('billing.plan')}</div>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							marginTop: 6,
							flexWrap: 'wrap',
						}}
					>
						<strong style={{ fontSize: 18 }}>
							{subscription ? subscription.plan : t('billing.free')}
						</strong>
						{subscription ? (
							<>
								<span style={styles.muted}>· {intervalLabel(t, subscription.interval)}</span>
								<Pill tone={statusTone(subscription.status)}>
									{statusLabel(t, subscription.status)}
								</Pill>
							</>
						) : (
							<span style={styles.muted}>{t('billing.noSubscription')}</span>
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
						<div style={styles.statLabel}>{t('billing.credits')}</div>
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
								placeholder={wallet?.currency ?? t('billing.currencyPlaceholder')}
								maxLength={8}
								style={{ ...styles.input, height: 26, width: 84, fontSize: 12 }}
								aria-label={t('billing.currencyLabel')}
								title={t('billing.currencyTitle')}
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
								{t('billing.breakdown', {
									permanent: wallet.purchased ?? '0',
									allowance: wallet.granted ?? '0',
								})}
								{wallet.grantedExpiresAt
									? t('billing.expires', {
											date: formatAdminDate(wallet.grantedExpiresAt, locale, 'date'),
										})
									: ''}
							</div>
						</>
					) : (
						<div style={styles.statHint}>{t('billing.noWallet')}</div>
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
								setGranted(
									t('billing.granted', { amount: amount.trim(), currency: wallet.currency }),
								);
								setAmount('');
								setNote('');
							})
							.catch(() => {});
					}}
				>
					<strong style={{ fontSize: 13.5, marginRight: 4 }}>{t('billing.grantCredits')}</strong>
					<input
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						placeholder={t('billing.amountPlaceholder', { currency: wallet.currency })}
						inputMode="numeric"
						style={{ ...styles.input, width: 150 }}
						aria-label={t('billing.amountLabel')}
					/>
					<input
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder={t('billing.reasonPlaceholder')}
						style={{ ...styles.input, flex: 1, minWidth: 180 }}
						aria-label={t('billing.reasonLabel')}
					/>
					<button
						type="submit"
						style={styles.buttonPrimary}
						disabled={!/^\d+$/.test(amount.trim())}
					>
						<Icon name="plus" size={14} />
						{t('billing.grant')}
					</button>
					{granted ? <span style={styles.ok}>{granted}</span> : null}
				</form>
			) : null}

			{wallet ? (
				ledger.length === 0 ? (
					<Empty icon="subscriber" title={t('billing.noMovements')} />
				) : (
					<>
						<table style={styles.table}>
							<thead>
								<tr>
									<th style={styles.th}>{t('billing.col.when')}</th>
									<th style={styles.th}>{t('billing.col.kind')}</th>
									<th style={styles.th}>{t('billing.col.amount')}</th>
									<th style={styles.th}>{t('billing.col.note')}</th>
								</tr>
							</thead>
							<tbody>
								{ledger.map((tx) => (
									<tr key={tx.id}>
										<td style={{ ...styles.td, ...styles.muted, whiteSpace: 'nowrap' }}>
											{formatAdminDate(tx.createdAt, locale)}
										</td>
										<td style={styles.td}>{ledgerKind(tx.type)}</td>
										<td style={{ ...styles.td, ...styles.mono }}>{tx.amount}</td>
										<td style={{ ...styles.td, ...styles.muted }}>{tx.description ?? ''}</td>
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
								{t('common.loadMore')}
							</button>
						) : null}
					</>
				)
			) : null}
		</>
	);
}
