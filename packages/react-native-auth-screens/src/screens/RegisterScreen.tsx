import type { AuthClient, IRegisterResult } from '@fonderie/client';
import { useRegister } from '@fonderie/react-native-auth';
import { useState } from 'react';
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface IRegisterScreenProps {
	client?: AuthClient;
	onRegisterSuccess?: (result: IRegisterResult) => void;
	onNavigateToLogin?: () => void;
}

export function RegisterScreen({
	client,
	onRegisterSuccess,
	onNavigateToLogin,
}: IRegisterScreenProps) {
	const { register, isLoading, error } = useRegister(client);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setValidationError(null);
		if (!EMAIL_PATTERN.test(email)) {
			setValidationError('Enter a valid email address.');
			return;
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			setValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
			return;
		}
		try {
			const result = await register({ email, password, firstName, lastName });
			onRegisterSuccess?.(result);
		} catch {
			// Surfaced via `error` from useRegister.
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Create Account</Text>

			<TextInput
				style={styles.input}
				placeholder="First name"
				value={firstName}
				onChangeText={setFirstName}
				accessibilityLabel="First name input"
			/>

			<TextInput
				style={styles.input}
				placeholder="Last name"
				value={lastName}
				onChangeText={setLastName}
				accessibilityLabel="Last name input"
			/>

			<TextInput
				style={styles.input}
				placeholder="Email"
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				accessibilityLabel="Email input"
			/>

			<TextInput
				style={styles.input}
				placeholder="Password"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				accessibilityLabel="Password input"
				accessibilityHint={`At least ${MIN_PASSWORD_LENGTH} characters`}
			/>

			{(validationError || error) && (
				<Text style={styles.error} accessibilityRole="alert">
					{validationError ?? error?.explanation}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleSubmit}
				disabled={isLoading}
				style={styles.button}
				accessibilityLabel="Create account button"
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>Create Account</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToLogin}>
				<Text style={styles.link}>
					Already have an account? <Text style={styles.linkBold}>Sign in</Text>
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
