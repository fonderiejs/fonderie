import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { useVerifyEmail } from '@fonderie/react-native-auth';
import { useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

export interface IVerifyEmailScreenProps {
	client?: AuthClient;
	onVerified?: (result: IVerifyEmailResult) => void;
}

export function VerifyEmailScreen({ client, onVerified }: IVerifyEmailScreenProps) {
	const { verifyEmail, resend, resent, isLoading, error } = useVerifyEmail(client);
	const [code, setCode] = useState('');

	const handleSubmit = async () => {
		try {
			const result = await verifyEmail(code);
			onVerified?.(result);
		} catch {
			// Surfaced via `error` from useVerifyEmail.
		}
	};

	const handleResend = async () => {
		try {
			await resend();
		} catch {
			// Surfaced via `error` from useVerifyEmail.
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Verify your email</Text>
			<Text style={styles.body}>Enter the 6-digit code we sent to your email address.</Text>

			<TextInput
				style={styles.input}
				placeholder="6-digit code"
				value={code}
				onChangeText={setCode}
				autoCapitalize="none"
				keyboardType="number-pad"
				accessibilityLabel="Verification code input"
				accessibilityHint="Enter the 6-digit code from your email"
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

			{resent ? (
				<Text style={styles.sent}>A new verification email has been sent.</Text>
			) : (
				<TouchableOpacity onPress={handleResend} disabled={isLoading}>
					<Text style={styles.link}>
						Didn't get a code? <Text style={styles.linkBold}>Resend email</Text>
					</Text>
				</TouchableOpacity>
			)}
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
	sent: { marginTop: 16, textAlign: 'center', color: '#666' },
	link: { marginTop: 16, textAlign: 'center', color: '#666' },
	linkBold: { fontWeight: '600', color: '#000' },
});
