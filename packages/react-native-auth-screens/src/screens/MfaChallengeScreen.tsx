import type { AuthClient, ILoginResult } from '@fonderie/client';
import { useMfaLogin } from '@fonderie/react-native-auth';
import { useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

export interface IMfaChallengeScreenProps {
	client?: AuthClient;
	// The temporary token from a login that returned MFA_REQUIRED.
	mfaToken: string;
	onLoginSuccess?: (result: ILoginResult) => void;
	onNavigateToLogin?: () => void;
}

export function MfaChallengeScreen({
	client,
	mfaToken,
	onLoginSuccess,
	onNavigateToLogin,
}: IMfaChallengeScreenProps) {
	const { verifyLogin, isLoading, error } = useMfaLogin(client);
	const [code, setCode] = useState('');

	const handleSubmit = async () => {
		try {
			const result = await verifyLogin(mfaToken, code);
			onLoginSuccess?.(result);
		} catch {
			// Surfaced via `error` from useMfaLogin.
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Two-factor authentication</Text>
			<Text style={styles.body}>Enter the 6-digit code from your authenticator app.</Text>

			<TextInput
				style={styles.input}
				placeholder="6-digit code"
				value={code}
				onChangeText={setCode}
				autoCapitalize="none"
				keyboardType="number-pad"
				accessibilityLabel="Authentication code input"
				accessibilityHint="Enter the 6-digit code from your authenticator app"
			/>

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{error.explanation}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleSubmit}
				disabled={isLoading}
				style={styles.button}
				accessibilityLabel="Verify button"
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Verify</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToLogin}>
				<Text style={styles.link}>Back to sign in</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1, justifyContent: 'center' },
	title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
	body: { fontSize: 14, color: '#666', marginBottom: 24 },
	input: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
		fontSize: 16,
	},
	button: {
		backgroundColor: '#000',
		padding: 14,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 8,
	},
	buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	link: { marginTop: 16, textAlign: 'center', color: '#666' },
});
