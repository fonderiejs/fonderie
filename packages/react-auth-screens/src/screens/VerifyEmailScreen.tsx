import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/react';
import { useVerifyEmail } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface IVerifyEmailScreenProps {
	client?: AuthClient;
	onVerified?: (result: IVerifyEmailResult) => void;
	/** The language for this screen only; default: the client's UI language (client.setLocale). */
	locale?: string;
}

export function VerifyEmailScreen({ client, onVerified, locale }: IVerifyEmailScreenProps) {
	const { verifyEmail, resend, resent, isLoading, error } = useVerifyEmail(client);
	const t = useUiT(client, locale);
	const errorText = useUiError(client, locale);
	const [code, setCode] = useState('');

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
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
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>{t('auth.verify.title')}</h1>
			<p style={styles.body}>{t('auth.verify.lead')}</p>

			<label htmlFor="fonderie-verify-email-code" style={styles.visuallyHidden}>
				{t('auth.verify.codeLabel')}
			</label>
			<input
				id="fonderie-verify-email-code"
				style={styles.input}
				type="text"
				inputMode="numeric"
				placeholder={t('auth.fields.code')}
				value={code}
				onChange={(event) => setCode(event.target.value)}
				autoComplete="one-time-code"
				required
			/>

			{error && (
				<p style={styles.error} role="alert">
					{errorText(error)}
				</p>
			)}

			<button type="submit" disabled={isLoading} style={styles.button}>
				{isLoading ? t('auth.verify.submitting') : t('auth.verify.submit')}
			</button>

			{resent ? (
				<p style={styles.sent}>{t('auth.verify.resent')}</p>
			) : (
				<button type="button" disabled={isLoading} onClick={handleResend} style={styles.link}>
					{t('auth.verify.noCode')} <strong>{t('auth.verify.resend')}</strong>
				</button>
			)}
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
	sent: { marginTop: 16, textAlign: 'center', color: '#666', fontSize: 14 },
	link: {
		marginTop: 16,
		background: 'none',
		border: 'none',
		color: '#666',
		cursor: 'pointer',
		fontSize: 14,
	},
	visuallyHidden: {
		position: 'absolute',
		width: 1,
		height: 1,
		overflow: 'hidden',
		clip: 'rect(0 0 0 0)',
	},
};
