import type { AuthClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
import { useForgotPassword } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

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

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		try {
			await forgotPassword(email);
		} catch {
			// Surfaced via `error` from useForgotPassword.
		}
	};

	if (sent) {
		return (
			<div style={styles.container}>
				<h1 style={styles.title}>{t('auth.forgot.sentTitle')}</h1>
				<p style={styles.body}>{t('auth.forgot.sentBody', { email })}</p>
				<button type="button" onClick={onNavigateToLogin} style={styles.link}>
					{t('auth.backToSignIn')}
				</button>
			</div>
		);
	}

	return (
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>{t('auth.forgot.title')}</h1>
			<p style={styles.body}>{t('auth.forgot.lead')}</p>

			<input
				style={styles.input}
				type="email"
				placeholder={t('auth.fields.email')}
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				autoComplete="email"
				required
			/>

			{error && (
				<p style={styles.error} role="alert">
					{errorText(error)}
				</p>
			)}

			<button type="submit" disabled={isLoading} style={styles.button}>
				{isLoading ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
			</button>

			<button type="button" onClick={onNavigateToLogin} style={styles.link}>
				{t('auth.backToSignIn')}
			</button>
		</form>
	);
}

const styles: Record<string, CSSProperties> = {
	container: {
		padding: 24,
		maxWidth: 360,
		margin: '0 auto',
		display: 'flex',
		flexDirection: 'column',
	},
	title: { fontSize: 28, fontWeight: 700, marginBottom: 12 },
	body: { fontSize: 14, color: '#666', marginBottom: 24 },
	input: {
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
		fontSize: 16,
	},
	button: {
		backgroundColor: '#000',
		color: '#fff',
		padding: 14,
		borderRadius: 8,
		border: 'none',
		fontSize: 16,
		fontWeight: 600,
		cursor: 'pointer',
		marginTop: 8,
	},
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	link: {
		marginTop: 16,
		background: 'none',
		border: 'none',
		color: '#666',
		cursor: 'pointer',
		fontSize: 14,
	},
};
