import type { BillingClient, IPlanDTO } from '@fonderie/client';
import { canonicalLocaleTag, uiLocaleFor } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
import { useCheckout, usePlans } from '@fonderie/react-native-billing';
import { useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Linking,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

export interface IPricingScreenProps {
	client?: BillingClient;
	onCheckoutStart?: (url: string) => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

// In the UI language (undefined = the runtime's default), never a hard-coded one.
function formatPrice(cents: number, currency: string, locale: string | undefined): string {
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function PricingScreen({ client, onCheckoutStart, locale }: IPricingScreenProps) {
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	const formatLocale = canonicalLocaleTag(locale) ?? uiLocaleFor(client)?.get();
	const { plans, isLoading, error } = usePlans(client);
	const { checkout, isLoading: isCheckingOut, error: checkoutError } = useCheckout(client);
	const [interval, setInterval] = useState<'month' | 'year'>('month');

	const handleChoose = async (planName: string) => {
		try {
			const url = await checkout({ plan: planName, interval });
			if (onCheckoutStart) onCheckoutStart(url);
			else await Linking.openURL(url);
		} catch {
			// Surfaced via `checkoutError` from useCheckout.
		}
	};

	if (isLoading) return <Text style={styles.status}>{t('billing.pricing.loading')}</Text>;
	if (error)
		return (
			<Text style={styles.error} accessibilityRole="alert">
				{errorText(error)}
			</Text>
		);

	const renderPlan = ({ item: plan }: { item: IPlanDTO }) => (
		<View style={styles.card}>
			<Text style={styles.planName}>{plan.name}</Text>
			<Text style={styles.planDescription}>{plan.description}</Text>
			<Text style={styles.price}>
				{formatPrice(
					interval === 'year' ? plan.pricing.yearly : plan.pricing.monthly,
					plan.pricing.currency,
					formatLocale,
				)}
				<Text style={styles.priceInterval}>
					{interval === 'year' ? t('billing.pricing.perYear') : t('billing.pricing.perMonth')}
				</Text>
			</Text>
			{plan.features
				.filter((f) => f.enabled)
				.map((f) => (
					<Text key={f.name} style={styles.feature}>
						{f.description || f.name}
					</Text>
				))}
			<TouchableOpacity
				disabled={isCheckingOut}
				onPress={() => handleChoose(plan.name)}
				style={styles.button}
				accessibilityRole="button"
				accessibilityLabel={
					isCheckingOut
						? t('billing.pricing.redirecting')
						: t('billing.pricing.choose', { plan: plan.name })
				}
			>
				{isCheckingOut ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('billing.pricing.choose', { plan: plan.name })}</Text>
				)}
			</TouchableOpacity>
		</View>
	);

	return (
		<View style={styles.container}>
			<View style={styles.toggle}>
				<TouchableOpacity
					onPress={() => setInterval('month')}
					accessibilityRole="button"
					accessibilityState={{ selected: interval === 'month' }}
					style={interval === 'month' ? styles.toggleActive : styles.toggleButton}
				>
					<Text style={interval === 'month' ? styles.toggleActiveText : styles.toggleButtonText}>
						{t('billing.pricing.monthly')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() => setInterval('year')}
					accessibilityRole="button"
					accessibilityState={{ selected: interval === 'year' }}
					style={interval === 'year' ? styles.toggleActive : styles.toggleButton}
				>
					<Text style={interval === 'year' ? styles.toggleActiveText : styles.toggleButtonText}>
						{t('billing.pricing.yearly')}
					</Text>
				</TouchableOpacity>
			</View>

			{checkoutError && (
				<Text style={styles.error} accessibilityRole="alert">
					{errorText(checkoutError)}
				</Text>
			)}

			<FlatList data={plans} keyExtractor={(p) => p.id} renderItem={renderPlan} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', textAlign: 'center', marginBottom: 12 },
	toggle: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
	toggleButton: {
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
	},
	toggleButtonText: { color: '#000' },
	toggleActive: {
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: '#000',
		borderRadius: 8,
		backgroundColor: '#000',
	},
	toggleActiveText: { color: '#fff' },
	card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 24, marginBottom: 16 },
	planName: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
	planDescription: { color: '#666', fontSize: 14, marginBottom: 16 },
	price: { fontSize: 32, fontWeight: '700', marginBottom: 16 },
	priceInterval: { fontSize: 14, fontWeight: '400', color: '#666' },
	feature: { fontSize: 14, color: '#333', marginBottom: 4 },
	button: {
		marginTop: 16,
		backgroundColor: '#000',
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
