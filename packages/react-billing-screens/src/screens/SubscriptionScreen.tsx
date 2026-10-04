import type { BillingClient, UiMessageKey, UiT } from '@fonderie/client';
import { canonicalLocaleTag, uiLocaleFor } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
import {
	useBillingPortal,
	usePaymentMethod,
	useRemovePaymentMethod,
	useSubscription,
} from '@fonderie/react-billing';
import type { CSSProperties } from 'react';

// A server-reported state ('past_due') in words; an unknown one shown as-is.
function statusLabel(t: UiT, status: string): string {
	const key = `billing.status.${status}` as UiMessageKey;
	const word = t(key);
	return word === key ? status : word;
}

export interface ISubscriptionScreenProps {
	client?: BillingClient;
	onManageBilling?: (url: string) => void;
	onNavigateToPricing?: () => void;
	// The host owns the Stripe Payment Element (publishable key + <Elements>), so
	// adding/replacing a card is delegated up — same way onManageBilling receives
	// a portal URL. useSetupPaymentMethod/useSavePaymentMethod live there; this
	// provider-agnostic screen only shows + removes the card.
	onAddPaymentMethod?: () => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function SubscriptionScreen({
	client,
	onManageBilling,
	onNavigateToPricing,
	onAddPaymentMethod,
	locale,
}: ISubscriptionScreenProps) {
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	const formatLocale = canonicalLocaleTag(locale) ?? uiLocaleFor(client)?.get();
	const { subscription, isLoading, error } = useSubscription(client);
	const { openPortal, isLoading: isOpeningPortal, error: portalError } = useBillingPortal(client);
	const {
		paymentMethod,
		isLoading: isLoadingCard,
		error: cardError,
		refresh: refreshCard,
	} = usePaymentMethod(client);
	const { remove, isLoading: isRemoving, error: removeError } = useRemovePaymentMethod(client);

	const handleManage = async () => {
		try {
			const url = await openPortal();
			if (onManageBilling) onManageBilling(url);
			else window.location.href = url;
		} catch {
			// Surfaced via `portalError` from useBillingPortal.
		}
	};

	const handleRemove = async () => {
		try {
			await remove();
			await refreshCard({ force: true });
		} catch {
			// Surfaced via `removeError` from useRemovePaymentMethod.
		}
	};

	if (isLoading) return <p style={styles.status}>{t('billing.subscription.loading')}</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{errorText(error)}
			</p>
		);

	if (!subscription) {
		return (
			<div style={styles.container}>
				<p style={styles.status}>{t('billing.subscription.none')}</p>
				<button type="button" onClick={onNavigateToPricing} style={styles.button}>
					{t('billing.subscription.viewPlans')}
				</button>
			</div>
		);
	}

	const brand = paymentMethod
		? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)
		: '';

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{t('billing.subscription.title')}</h1>
			<p style={styles.plan}>{subscription.plan}</p>
			<p style={styles.status}>
				{t(
					subscription.cancelAtPeriodEnd
						? 'billing.subscription.statusLineCanceling'
						: 'billing.subscription.statusLine',
					{ status: statusLabel(t, subscription.status) },
				)}
			</p>
			{subscription.currentPeriodEnd && (
				<p style={styles.status}>
					{t(subscription.cancelAtPeriodEnd ? 'billing.subscription.ends' : 'billing.subscription.renews', {
						date: new Date(subscription.currentPeriodEnd).toLocaleDateString(formatLocale),
					})}
				</p>
			)}

			{portalError && (
				<p style={styles.error} role="alert">
					{errorText(portalError)}
				</p>
			)}

			<button type="button" disabled={isOpeningPortal} onClick={handleManage} style={styles.button}>
				{isOpeningPortal ? t('billing.subscription.opening') : t('billing.subscription.manage')}
			</button>

			<div style={styles.section}>
				<h2 style={styles.sectionTitle}>{t('billing.paymentMethod.title')}</h2>
				{isLoadingCard && !paymentMethod ? (
					<p style={styles.status}>{t('billing.paymentMethod.loading')}</p>
				) : (
					<>
						{cardError && (
							<p style={styles.error} role="alert">
								{errorText(cardError)}
							</p>
						)}
						{removeError && (
							<p style={styles.error} role="alert">
								{errorText(removeError)}
							</p>
						)}
						{paymentMethod?.type === 'link' ? (
							// Stripe Link: no card details — the Link account is what pays.
							<p style={styles.cardLine}>
								{paymentMethod.email
									? t('billing.paymentMethod.linkWithEmail', { email: paymentMethod.email })
									: t('billing.paymentMethod.link')}
							</p>
						) : paymentMethod ? (
							<p style={styles.cardLine}>
								{t('billing.paymentMethod.card', {
									brand,
									last4: paymentMethod.last4,
									month: paymentMethod.expMonth,
									year: paymentMethod.expYear,
								})}
							</p>
						) : (
							<p style={styles.status}>{t('billing.paymentMethod.none')}</p>
						)}
						<div style={styles.buttonRow}>
							<button type="button" onClick={onAddPaymentMethod} style={styles.secondaryButton}>
								{paymentMethod ? t('billing.paymentMethod.update') : t('billing.paymentMethod.add')}
							</button>
							{paymentMethod && (
								<button
									type="button"
									disabled={isRemoving}
									onClick={handleRemove}
									style={styles.dangerButton}
								>
									{isRemoving
										? t('billing.paymentMethod.removing')
										: t('billing.paymentMethod.remove')}
								</button>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 400 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	plan: { fontSize: 18, fontWeight: 600, marginBottom: 4 },
	status: { color: '#666', fontSize: 14, marginBottom: 4 },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	button: {
		marginTop: 16,
		backgroundColor: '#000',
		color: '#fff',
		padding: '12px 20px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
	section: { marginTop: 24, paddingTop: 24, borderTop: '1px solid #eee' },
	sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 8 },
	cardLine: { fontSize: 14, color: '#333', marginBottom: 12 },
	buttonRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
	secondaryButton: {
		backgroundColor: '#fff',
		color: '#000',
		padding: '8px 16px',
		borderRadius: 8,
		border: '1px solid #ddd',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
	dangerButton: {
		backgroundColor: '#fff',
		color: '#e11d48',
		padding: '8px 16px',
		borderRadius: 8,
		border: '1px solid #f3c0cb',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
};
