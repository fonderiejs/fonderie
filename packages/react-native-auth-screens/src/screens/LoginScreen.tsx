import type { AuthClient, ILoginResult } from '@fonderie/client';
import { isMfaRequired } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
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
	client?: AuthClient;
	onLoginSuccess?: (result: ILoginResult) => void;
	// Called instead of onLoginSuccess when the account requires MFA.
	onMfaRequired?: (mfaToken: string) => void;
	onNavigateToRegister?: () => void;
	onNavigateToForgotPassword?: () => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function LoginScreen({
	client,
	onLoginSuccess,
	onMfaRequired,
	onNavigateToRegister,
	onNavigateToForgotPassword,
	locale,
}: ILoginScreenProps) {
	const { login, isLoading, error } = useLogin(client);
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const handleSubmit = async () => {
		try {
			const result = await login({ email, password });
			if (isMfaRequired(result)) {
				onMfaRequired?.(result.mfaToken);
				return;
			}
			onLoginSuccess?.(result);
		} catch {
			// Surfaced via `error` from useLogin.
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('auth.login.title')}</Text>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.email')}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				accessibilityLabel={t('auth.login.a11y.email')}
				accessibilityHint={t('auth.login.a11y.emailHint')}
			/>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.password')}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				accessibilityLabel={t('auth.login.a11y.password')}
				accessibilityHint={t('auth.login.a11y.passwordHint')}
			/>

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{errorText(error)}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleSubmit}
				disabled={isLoading}
				style={styles.button}
				accessibilityLabel={t('auth.login.a11y.submit')}
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('auth.login.submit')}</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToForgotPassword}>
				<Text style={styles.link}>{t('auth.login.forgotPassword')}</Text>
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToRegister}>
				<Text style={styles.link}>
					{t('auth.login.noAccount')} <Text style={styles.linkBold}>{t('auth.login.signUp')}</Text>
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
