import type { BillingClient } from '@fonderie/client';
import { useBillingPortal, useSubscription } from '@fonderie/react-billing';
import type { CSSProperties } from 'react';

export interface ISubscriptionScreenProps {
	client?: BillingClient;
	onManageBilling?: (url: string) => void;
	onNavigateToPricing?: () => void;
}

export function SubscriptionScreen({
	client,
	onManageBilling,
	onNavigateToPricing,
}: ISubscriptionScreenProps) {
	const { subscription, isLoading, error } = useSubscription(client);
	const { openPortal, isLoading: isOpeningPortal, error: portalError } = useBillingPortal(client);

	const handleManage = async () => {
		try {
			const url = await openPortal();
			if (onManageBilling) onManageBilling(url);
			else window.location.href = url;
		} catch {
			// Surfaced via `portalError` from useBillingPortal.
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
};
