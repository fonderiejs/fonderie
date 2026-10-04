import type { AuthClient, ILoginResult } from '@fonderie/client';
import { useUiT } from '@fonderie/react';
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
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function MfaChallengeScreen({
	client,
	mfaToken,
	onLoginSuccess,
	onNavigateToLogin,
	locale,
}: IMfaChallengeScreenProps) {
	const { verifyLogin, isLoading, error } = useMfaLogin(client);
	const t = useUiT(client, locale);
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
			<Text style={styles.title}>{t('auth.mfa.title')}</Text>
			<Text style={styles.body}>{t('auth.mfa.lead')}</Text>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.code')}
				value={code}
				onChangeText={setCode}
				autoCapitalize="none"
				keyboardType="number-pad"
				accessibilityLabel={t('auth.mfa.a11y.code')}
				accessibilityHint={t('auth.mfa.a11y.codeHint')}
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
				accessibilityLabel={t('auth.mfa.a11y.submit')}
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('auth.mfa.submit')}</Text>
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
