import type { AuthClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
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
	client?: AuthClient;
	onNavigateToLogin?: () => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function ForgotPasswordScreen({
	client,
	onNavigateToLogin,
	locale,
}: IForgotPasswordScreenProps) {
	const { forgotPassword, isLoading, error, sent } = useForgotPassword(client);
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
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
				<Text style={styles.title}>{t('auth.forgot.sentTitle')}</Text>
				<Text style={styles.body}>{t('auth.forgot.sentBody', { email })}</Text>
				<TouchableOpacity onPress={onNavigateToLogin}>
					<Text style={styles.link}>{t('auth.backToSignIn')}</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('auth.forgot.title')}</Text>
			<Text style={styles.body}>{t('auth.forgot.lead')}</Text>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.email')}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
				accessibilityLabel={t('auth.forgot.a11y.email')}
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
				accessibilityLabel={t('auth.forgot.a11y.submit')}
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('auth.forgot.submit')}</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity onPress={onNavigateToLogin}>
				<Text style={styles.link}>{t('auth.backToSignIn')}</Text>
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
