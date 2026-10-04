import type { AuthClient, IRegisterResult } from '@fonderie/client';
import { uiLocaleFor } from '@fonderie/client';
import { useFonderieSubClient, useUiT } from '@fonderie/react';
import { useRegister } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

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
	// The new account's language: this screen's, else the client's UI language.
	const authClient = useFonderieSubClient(client, (c) => c.auth, 'RegisterScreen');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
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
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>{t('auth.register.title')}</h1>

			<input
				style={styles.input}
				type="text"
				placeholder={t('auth.fields.firstName')}
				value={firstName}
				onChange={(event) => setFirstName(event.target.value)}
				autoComplete="given-name"
			/>

			<input
				style={styles.input}
				type="text"
				placeholder={t('auth.fields.lastName')}
				value={lastName}
				onChange={(event) => setLastName(event.target.value)}
				autoComplete="family-name"
			/>

			<input
				style={styles.input}
				type="email"
				placeholder={t('auth.fields.email')}
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				autoComplete="email"
				required
			/>

			<input
				style={styles.input}
				type="password"
				placeholder={t('auth.fields.password')}
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				autoComplete="new-password"
				minLength={MIN_PASSWORD_LENGTH}
				required
			/>

			{(validationError || error) && (
				<p style={styles.error} role="alert">
					{validationError ?? error?.explanation}
				</p>
			)}

			<button type="submit" disabled={isLoading} style={styles.button}>
				{isLoading ? t('auth.register.submitting') : t('auth.register.submit')}
			</button>

			<button type="button" onClick={onNavigateToLogin} style={styles.link}>
				{t('auth.register.haveAccount')} <strong>{t('auth.register.signIn')}</strong>
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
	title: { fontSize: 28, fontWeight: 700, marginBottom: 24 },
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
