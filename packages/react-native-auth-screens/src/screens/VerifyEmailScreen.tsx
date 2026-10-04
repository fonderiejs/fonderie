import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { useUiT } from '@fonderie/react';
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
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function VerifyEmailScreen({ client, onVerified, locale }: IVerifyEmailScreenProps) {
	const { verifyEmail, resend, resent, isLoading, error } = useVerifyEmail(client);
	const t = useUiT(client, locale);
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
			<Text style={styles.title}>{t('auth.verify.title')}</Text>
			<Text style={styles.body}>{t('auth.verify.lead')}</Text>

			<TextInput
				style={styles.input}
				placeholder={t('auth.fields.code')}
				value={code}
				onChangeText={setCode}
				autoCapitalize="none"
				keyboardType="number-pad"
				accessibilityLabel={t('auth.verify.a11y.code')}
				accessibilityHint={t('auth.verify.a11y.codeHint')}
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
				accessibilityLabel={t('auth.verify.a11y.submit')}
				accessibilityRole="button"
			>
				{isLoading ? (
					<ActivityIndicator color="#fff" />
				) : (
					<Text style={styles.buttonText}>{t('auth.verify.submit')}</Text>
				)}
			</TouchableOpacity>

			{resent ? (
				<Text style={styles.sent}>{t('auth.verify.resent')}</Text>
			) : (
				<TouchableOpacity onPress={handleResend} disabled={isLoading}>
					<Text style={styles.link}>
						{t('auth.verify.noCode')} <Text style={styles.linkBold}>{t('auth.verify.resend')}</Text>
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
