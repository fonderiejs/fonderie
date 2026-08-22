import type { AuthClient } from '@fonderie/client';
import { useResetPassword } from '@fonderie/react-native-auth';
import { useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

export interface IResetPasswordScreenProps {
	client?: AuthClient;
	// Pre-fills the pin input, e.g. when it arrives via a deep link.
	initialPin?: string;
	onResetSuccess?: () => void;
	onNavigateToLogin?: () => void;
}

export function ResetPasswordScreen({
	client,
	initialPin,
	onResetSuccess,
	onNavigateToLogin,
}: IResetPasswordScreenProps) {
	const { resetPassword, isLoading, error, done } = useResetPassword(client);
	const [pin, setPin] = useState(initialPin ?? '');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [mismatch, setMismatch] = useState(false);

	const handleSubmit = async () => {
		if (password !== confirmPassword) {
			setMismatch(true);
			return;
		}
		setMismatch(false);
		try {
			await resetPassword({ pin, password });
			onResetSuccess?.();
		} catch {
			// Surfaced via `error` from useResetPassword.
		}
	};

	if (done) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>Password updated</Text>
				<Text style={styles.body}>
					Your password has been reset. Sign in with your new password.
				</Text>
				<TouchableOpacity
					onPress={onNavigateToLogin}
					style={styles.button}
					accessibilityLabel="Go to sign in button"
					accessibilityRole="button"
				>
					<Text style={styles.buttonText}>Go to sign in</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Choose a new password</Text>
			<Text style={styles.body}>
				Enter the 6-digit code from your email and your new password.
			</Text>

			<TextInput
				style={styles.input}
				placeholder="6-digit code"
				value={pin}
				onChangeText={setPin}
				autoCapitalize="none"
				keyboardType="number-pad"
				accessibilityLabel="Reset code input"
				accessibilityHint="Enter the 6-digit code from your email"
			/>

			<TextInput
				style={styles.input}
				placeholder="New password"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				accessibilityLabel="New password input"
				accessibilityHint="Enter your new password"
			/>

			<TextInput
				style={styles.input}
				placeholder="Confirm new password"
				value={confirmPassword}
				onChangeText={setConfirmPassword}
				secureTextEntry
				accessibilityLabel="Confirm new password input"
				accessibilityHint="Enter your new password again"
			/>

			{mismatch && (
				<Text style={styles.error} accessibilityRole="alert">
					Passwords do not match.
				</Text>
			)}

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{error.explanation}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleSubmit}
				disabled={isLoading}
				style={styles.button}
				accessibilityLabel="Reset password button"
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Reset password</Text>
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
