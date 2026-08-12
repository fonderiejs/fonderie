import type { AuthClient } from '@fonderie/client';
import { useForgotPassword } from '@fonderie/react-native-auth';
import { useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

export interface IForgotPasswordScreenProps {
	client: AuthClient;
	onNavigateToLogin?: () => void;
}

export function ForgotPasswordScreen({ client, onNavigateToLogin }: IForgotPasswordScreenProps) {
	const { forgotPassword, isLoading, error, sent } = useForgotPassword(client);
	const [email, setEmail] = useState('');

	const handleSubmit = async () => {
		try {
			await forgotPassword(email);
		} catch {
			// Surfaced via `error` from useForgotPassword.
		}
	};

	if (sent) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>Check your email</Text>
				<Text style={styles.body}>
					If an account exists for {email}, we've sent instructions to reset your password.
				</Text>
				<TouchableOpacity onPress={onNavigateToLogin}>
					<Text style={styles.link}>Back to sign in</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Reset your password</Text>
			<Text style={styles.body}>
				Enter your email and we'll send you a link to reset your password.
			</Text>

			<TextInput
				style={styles.input}
				placeholder="Email"
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				accessibilityLabel="Email input"
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
				accessibilityLabel="Send reset link button"
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Send reset link</Text>
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
