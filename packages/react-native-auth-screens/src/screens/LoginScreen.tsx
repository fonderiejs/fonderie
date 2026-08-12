import type { AuthClient, ILoginResult } from '@fonderie/client';
import { useLogin } from '@fonderie/react-native-auth';
import { useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

export interface ILoginScreenProps {
	client: AuthClient;
	onLoginSuccess?: (result: ILoginResult) => void;
	onNavigateToRegister?: () => void;
	onNavigateToForgotPassword?: () => void;
}

export function LoginScreen({
	client,
	onLoginSuccess,
	onNavigateToRegister,
	onNavigateToForgotPassword,
}: ILoginScreenProps) {
	const { login, isLoading, error } = useLogin(client);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const handleSubmit = async () => {
		try {
			const result = await login({ email, password });
			onLoginSuccess?.(result);
		} catch {
			// Surfaced via `error` from useLogin.
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Sign In</Text>

			<TextInput
				style={styles.input}
				placeholder="Email"
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				accessibilityLabel="Email input"
				accessibilityHint="Enter your email address"
			/>

			<TextInput
				style={styles.input}
				placeholder="Password"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				accessibilityLabel="Password input"
				accessibilityHint="Enter your password"
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
				accessibilityLabel="Sign in button"
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Sign In</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToForgotPassword}>
				<Text style={styles.link}>Forgot password?</Text>
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToRegister}>
				<Text style={styles.link}>
					Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
				</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { padding: 24, flex: 1, justifyContent: 'center' },
	title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
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
	linkBold: { fontWeight: '600', color: '#000' },
});
