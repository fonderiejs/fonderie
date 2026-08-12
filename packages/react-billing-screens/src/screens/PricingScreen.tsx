import type { BillingClient } from '@fonderie/client';
import { useCheckout, usePlans } from '@fonderie/react-billing';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface IPricingScreenProps {
	client: BillingClient;
	onCheckoutStart?: (url: string) => void;
}

function formatPrice(cents: number, currency: string): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function PricingScreen({ client, onCheckoutStart }: IPricingScreenProps) {
	const { plans, isLoading, error } = usePlans(client);
	const { checkout, isLoading: isCheckingOut, error: checkoutError } = useCheckout(client);
	const [interval, setInterval] = useState<'month' | 'year'>('month');

	const handleChoose = async (planName: string) => {
		try {
			const url = await checkout({ plan: planName, interval });
			if (onCheckoutStart) onCheckoutStart(url);
			else window.location.href = url;
		} catch {
			// Surfaced via `checkoutError` from useCheckout.
		}
	};

	if (isLoading) return <p style={styles.status}>Loading plans…</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<div style={styles.toggle}>
				<button
					type="button"
					onClick={() => setInterval('month')}
					style={interval === 'month' ? styles.toggleActive : styles.toggleButton}
				>
					Monthly
				</button>
				<button
					type="button"
					onClick={() => setInterval('year')}
					style={interval === 'year' ? styles.toggleActive : styles.toggleButton}
				>
					Yearly
				</button>
			</div>

			{checkoutError && (
				<p style={styles.error} role="alert">
					{checkoutError.explanation}
				</p>
			)}

			<div style={styles.grid}>
				{plans.map((plan) => (
					<div key={plan.id} style={styles.card}>
						<h2 style={styles.planName}>{plan.name}</h2>
						<p style={styles.planDescription}>{plan.description}</p>
						<p style={styles.price}>
							{formatPrice(
								interval === 'year' ? plan.pricing.yearly : plan.pricing.monthly,
								plan.pricing.currency,
							)}
							<span style={styles.priceInterval}>/{interval}</span>
						</p>
						<ul style={styles.features}>
							{plan.features
								.filter((f) => f.enabled)
								.map((f) => (
									<li key={f.name}>{f.description || f.name}</li>
								))}
						</ul>
						<button
							type="button"
							disabled={isCheckingOut}
							onClick={() => handleChoose(plan.name)}
							style={styles.button}
						>
							{isCheckingOut ? 'Redirecting…' : `Choose ${plan.name}`}
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', textAlign: 'center' },
	toggle: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 },
	toggleButton: {
		padding: '8px 16px',
		border: '1px solid #ddd',
		borderRadius: 8,
		background: 'none',
		cursor: 'pointer',
	},
	toggleActive: {
		padding: '8px 16px',
		border: '1px solid #000',
		borderRadius: 8,
		background: '#000',
		color: '#fff',
		cursor: 'pointer',
	},
	grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 },
	card: { border: '1px solid #ddd', borderRadius: 12, padding: 24 },
	planName: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
	planDescription: { color: '#666', fontSize: 14, marginBottom: 16 },
	price: { fontSize: 32, fontWeight: 700, marginBottom: 16 },
	priceInterval: { fontSize: 14, fontWeight: 400, color: '#666' },
	features: { listStyle: 'none', padding: 0, margin: '0 0 24px', fontSize: 14, color: '#333' },
	button: {
		width: '100%',
		backgroundColor: '#000',
		color: '#fff',
		padding: 12,
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
	},
};
