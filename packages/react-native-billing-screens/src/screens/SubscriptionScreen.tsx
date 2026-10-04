import type { BillingClient, UiMessageKey, UiT } from '@fonderie/client';
import { canonicalLocaleTag, uiLocaleFor } from '@fonderie/client';
import { useUiT } from '@fonderie/react';
import {
	useBillingPortal,
	usePaymentMethod,
	useRemovePaymentMethod,
	useSubscription,
} from '@fonderie/react-native-billing';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
	// The host owns the card-entry surface (a native Stripe SDK / payment sheet),
	// so adding/replacing a card is delegated up — same way onManageBilling
	// receives a portal URL. useSetupPaymentMethod/useSavePaymentMethod live
	// there; this provider-agnostic screen only shows + removes the card.
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
			else await Linking.openURL(url);
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

	if (isLoading) return <Text style={styles.status}>{t('billing.subscription.loading')}</Text>;
	if (error)
		return (
			<Text style={styles.error} accessibilityRole="alert">
				{error.explanation}
			</Text>
		);

	if (!subscription) {
		return (
			<View style={styles.container}>
				<Text style={styles.status}>{t('billing.subscription.none')}</Text>
				<TouchableOpacity
					onPress={onNavigateToPricing}
					style={styles.button}
					accessibilityRole="button"
				>
					<Text style={styles.buttonText}>{t('billing.subscription.viewPlans')}</Text>
				</TouchableOpacity>
			</View>
		);
	}

	const brand = paymentMethod
		? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)
		: '';

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('billing.subscription.title')}</Text>
			<Text style={styles.plan}>{subscription.plan}</Text>
			<Text style={styles.status}>
				{t(
					subscription.cancelAtPeriodEnd
						? 'billing.subscription.statusLineCanceling'
						: 'billing.subscription.statusLine',
					{ status: statusLabel(t, subscription.status) },
				)}
			</Text>
			{subscription.currentPeriodEnd && (
				<Text style={styles.status}>
					{t(subscription.cancelAtPeriodEnd ? 'billing.subscription.ends' : 'billing.subscription.renews', {
						date: new Date(subscription.currentPeriodEnd).toLocaleDateString(formatLocale),
					})}
				</Text>
			)}

			{portalError && (
				<Text style={styles.error} accessibilityRole="alert">
					{portalError.explanation}
				</Text>
			)}

			<TouchableOpacity
				disabled={isOpeningPortal}
				onPress={handleManage}
				style={styles.button}
				accessibilityRole="button"
				accessibilityLabel={
					isOpeningPortal ? t('billing.subscription.opening') : t('billing.subscription.manage')
				}
			>
				{isOpeningPortal ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('billing.subscription.manage')}</Text>
				)}
			</TouchableOpacity>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>{t('billing.paymentMethod.title')}</Text>
				{isLoadingCard && !paymentMethod ? (
					<Text style={styles.status}>{t('billing.paymentMethod.loading')}</Text>
				) : (
					<>
						{cardError && (
							<Text style={styles.error} accessibilityRole="alert">
								{cardError.explanation}
							</Text>
						)}
						{removeError && (
							<Text style={styles.error} accessibilityRole="alert">
								{removeError.explanation}
							</Text>
						)}
						{paymentMethod?.type === 'link' ? (
							// Stripe Link: no card details — the Link account is what pays.
							// Without this branch a Link payer saw an empty card line.
							<Text style={styles.cardLine}>
								{paymentMethod.email
									? t('billing.paymentMethod.linkWithEmail', { email: paymentMethod.email })
									: t('billing.paymentMethod.link')}
							</Text>
						) : paymentMethod ? (
							<Text style={styles.cardLine}>
								{t('billing.paymentMethod.card', {
									brand,
									last4: paymentMethod.last4,
									month: paymentMethod.expMonth,
									year: paymentMethod.expYear,
								})}
							</Text>
						) : (
							<Text style={styles.status}>{t('billing.paymentMethod.none')}</Text>
						)}
						<View style={styles.buttonRow}>
							<TouchableOpacity
								onPress={onAddPaymentMethod}
								style={styles.secondaryButton}
								accessibilityRole="button"
							>
								<Text style={styles.secondaryButtonText}>
									{paymentMethod
										? t('billing.paymentMethod.update')
										: t('billing.paymentMethod.add')}
								</Text>
							</TouchableOpacity>
							{paymentMethod && (
								<TouchableOpacity
									disabled={isRemoving}
									onPress={handleRemove}
									style={styles.dangerButton}
									accessibilityRole="button"
									accessibilityLabel={
										isRemoving
											? t('billing.paymentMethod.removing')
											: t('billing.paymentMethod.remove')
									}
								>
									{isRemoving ? (
										<ActivityIndicator color="#e11d48" />
									) : (
										<Text style={styles.dangerButtonText}>{t('billing.paymentMethod.remove')}</Text>
									)}
								</TouchableOpacity>
							)}
						</View>
					</>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24 },
	title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
	plan: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
	status: { color: '#666', fontSize: 14, marginBottom: 4 },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	button: {
		marginTop: 16,
		backgroundColor: '#000',
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
	section: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#eee' },
	sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
	cardLine: { fontSize: 14, color: '#333', marginBottom: 12 },
	buttonRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
	secondaryButton: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#ddd',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
	},
	secondaryButtonText: { color: '#000', fontSize: 14, fontWeight: '600' },
	dangerButton: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#f3c0cb',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
	},
	dangerButtonText: { color: '#e11d48', fontSize: 14, fontWeight: '600' },
});
