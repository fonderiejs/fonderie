import type { BillingClient } from '@fonderie/client';
import {
	useBillingPortal,
	usePaymentMethod,
	useRemovePaymentMethod,
	useSubscription,
} from '@fonderie/react-billing';
import type { CSSProperties } from 'react';

export interface ISubscriptionScreenProps {
	client?: BillingClient;
	onManageBilling?: (url: string) => void;
	onNavigateToPricing?: () => void;
	// The host owns the Stripe Payment Element (publishable key + <Elements>), so
	// adding/replacing a card is delegated up — same way onManageBilling receives
	// a portal URL. useSetupPaymentMethod/useSavePaymentMethod live there; this
	// provider-agnostic screen only shows + removes the card.
	onAddPaymentMethod?: () => void;
}

export function SubscriptionScreen({
	client,
	onManageBilling,
	onNavigateToPricing,
	onAddPaymentMethod,
}: ISubscriptionScreenProps) {
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

	if (isLoading) return <p style={styles.status}>Loading subscription…</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	if (!subscription) {
		return (
			<div style={styles.container}>
				<p style={styles.status}>You don't have an active subscription.</p>
				<button type="button" onClick={onNavigateToPricing} style={styles.button}>
					View plans
				</button>
			</div>
		);
	}

	const brand = paymentMethod
		? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)
		: '';

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Your subscription</h1>
			<p style={styles.plan}>{subscription.plan}</p>
			<p style={styles.status}>
				Status: {subscription.status}
				{subscription.cancelAtPeriodEnd && ' (cancels at period end)'}
			</p>
			{subscription.currentPeriodEnd && (
				<p style={styles.status}>
					Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
				</p>
			)}

			{portalError && (
				<p style={styles.error} role="alert">
					{portalError.explanation}
				</p>
			)}

			<button type="button" disabled={isOpeningPortal} onClick={handleManage} style={styles.button}>
				{isOpeningPortal ? 'Opening…' : 'Manage billing'}
			</button>

			<div style={styles.section}>
				<h2 style={styles.sectionTitle}>Payment method</h2>
				{isLoadingCard && !paymentMethod ? (
					<p style={styles.status}>Loading payment method…</p>
				) : (
					<>
						{cardError && (
							<p style={styles.error} role="alert">
								{cardError.explanation}
							</p>
						)}
						{removeError && (
							<p style={styles.error} role="alert">
								{removeError.explanation}
							</p>
						)}
						{paymentMethod ? (
							<p style={styles.cardLine}>
								{brand} •••• {paymentMethod.last4} · expires {paymentMethod.expMonth}/
								{paymentMethod.expYear}
							</p>
						) : (
							<p style={styles.status}>No card on file.</p>
						)}
						<div style={styles.buttonRow}>
							<button type="button" onClick={onAddPaymentMethod} style={styles.secondaryButton}>
								{paymentMethod ? 'Update card' : 'Add card'}
							</button>
							{paymentMethod && (
								<button
									type="button"
									disabled={isRemoving}
									onClick={handleRemove}
									style={styles.dangerButton}
								>
									{isRemoving ? 'Removing…' : 'Remove'}
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
