import type { AuthClient, IRegisterResult } from '@fonderie/client';
import { uiLocaleFor } from '@fonderie/client';
import { useFonderieSubClient, useUiError, useUiT } from '@fonderie/react';
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
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function RegisterScreen({
	client,
	onRegisterSuccess,
	onNavigateToLogin,
	locale,
}: IRegisterScreenProps) {
	const { register, isLoading, error } = useRegister(client);
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	// The new account's language: this screen's, else the client's UI language.
	const authClient = useFonderieSubClient(client, (c) => c.auth, 'RegisterScreen');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleSubmit = async () => {
		setValidationError(null);
		if (!EMAIL_PATTERN.test(email)) {
			setValidationError(t('auth.register.invalidEmail'));
			return;
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			setValidationError(t('auth.register.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
			return;
		}
		try {
			const signUpLocale = locale ?? uiLocaleFor(authClient)?.get();
			const result = await register({
				email,
				password,
				firstName,
				lastName,
				...(signUpLocale ? { locale: signUpLocale } : {}),
			});
			onRegisterSuccess?.(result);
		} catch {
			// Surfaced via `error` from useRegister.
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('auth.register.title')}</Text>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.firstName')}
				value={firstName}
				onChangeText={setFirstName}
				accessibilityLabel={t('auth.register.a11y.firstName')}
			/>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.lastName')}
				value={lastName}
				onChangeText={setLastName}
				accessibilityLabel={t('auth.register.a11y.lastName')}
			/>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.email')}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				accessibilityLabel={t('auth.register.a11y.email')}
			/>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.password')}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				accessibilityLabel={t('auth.register.a11y.password')}
				accessibilityHint={t('auth.register.passwordRule', { min: MIN_PASSWORD_LENGTH })}
			/>

			{(validationError || error) && (
				<Text style={styles.error} accessibilityRole="alert">
					{validationError ?? errorText(error)}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleSubmit}
				disabled={isLoading}
				style={styles.button}
				accessibilityLabel={t('auth.register.a11y.submit')}
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('auth.register.submit')}</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToLogin}>
				<Text style={styles.link}>
					{t('auth.register.haveAccount')}{' '}
					<Text style={styles.linkBold}>{t('auth.register.signIn')}</Text>
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
