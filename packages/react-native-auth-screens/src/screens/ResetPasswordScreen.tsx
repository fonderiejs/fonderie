import type { AuthClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
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
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function ResetPasswordScreen({
	client,
	initialPin,
	onResetSuccess,
	onNavigateToLogin,
	locale,
}: IResetPasswordScreenProps) {
	const { resetPassword, isLoading, error, done } = useResetPassword(client);
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
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
				<Text style={styles.title}>{t('auth.reset.doneTitle')}</Text>
				<Text style={styles.body}>{t('auth.reset.doneBody')}</Text>
				<TouchableOpacity
					onPress={onNavigateToLogin}
					style={styles.button}
					accessibilityLabel={t('auth.reset.a11y.goToSignIn')}
					accessibilityRole="button"
				>
					<Text style={styles.buttonText}>{t('auth.reset.goToSignIn')}</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t('auth.reset.title')}</Text>
			<Text style={styles.body}>{t('auth.reset.lead')}</Text>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.code')}
				value={pin}
				onChangeText={setPin}
				autoCapitalize="none"
				keyboardType="number-pad"
				accessibilityLabel={t('auth.reset.a11y.code')}
				accessibilityHint={t('auth.reset.a11y.codeHint')}
			/>

			<TextInput
				style={styles.input}
				placeholder={t('auth.reset.newPassword')}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
				accessibilityLabel={t('auth.reset.a11y.newPassword')}
				accessibilityHint={t('auth.reset.a11y.newPasswordHint')}
			/>

			<TextInput
				style={styles.input}
				placeholder={t('auth.reset.confirmPassword')}
				value={confirmPassword}
				onChangeText={setConfirmPassword}
				secureTextEntry
				accessibilityLabel={t('auth.reset.a11y.confirm')}
				accessibilityHint={t('auth.reset.a11y.confirmHint')}
			/>

			{mismatch && (
				<Text style={styles.error} accessibilityRole="alert">
					{t('auth.reset.mismatch')}
				</Text>
			)}

			{error && (
				<Text style={styles.error} accessibilityRole="alert">
					{errorText(error)}
				</Text>
			)}

			<TouchableOpacity
				onPress={handleSubmit}
				disabled={isLoading}
				style={styles.button}
				accessibilityLabel={t('auth.reset.a11y.submit')}
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('auth.reset.submit')}</Text>
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
