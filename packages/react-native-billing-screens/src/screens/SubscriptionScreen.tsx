import type { BillingClient } from '@fonderie/client';
import { useBillingPortal, useSubscription } from '@fonderie/react-native-billing';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
			else await Linking.openURL(url);
		} catch {
			// Surfaced via `portalError` from useBillingPortal.
		}
	};

	if (isLoading) return <Text style={styles.status}>Loading subscription…</Text>;
	if (error)
		return (
			<Text style={styles.error} accessibilityRole="alert">
				{error.explanation}
			</Text>
		);

	if (!subscription) {
		return (
			<View style={styles.container}>
				<Text style={styles.status}>You don't have an active subscription.</Text>
				<TouchableOpacity
					onPress={onNavigateToPricing}
					style={styles.button}
					accessibilityRole="button"
				>
					<Text style={styles.buttonText}>View plans</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Your subscription</Text>
			<Text style={styles.plan}>{subscription.plan}</Text>
			<Text style={styles.status}>
				Status: {subscription.status}
				{subscription.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}
			</Text>
			{subscription.currentPeriodEnd && (
				<Text style={styles.status}>
					Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
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
			>
				{isOpeningPortal ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Manage billing</Text>
				)}
			</TouchableOpacity>
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
});
