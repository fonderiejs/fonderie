import type { AuthClient, ILoginResult } from '@fonderie/client';
import { useMfaLogin } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface IMfaChallengeScreenProps {
	client?: AuthClient;
	// The temporary token from a login that returned MFA_REQUIRED.
	mfaToken: string;
	onLoginSuccess?: (result: ILoginResult) => void;
	onNavigateToLogin?: () => void;
}

export function MfaChallengeScreen({
	client,
	mfaToken,
	onLoginSuccess,
	onNavigateToLogin,
}: IMfaChallengeScreenProps) {
	const { verifyLogin, isLoading, error } = useMfaLogin(client);
	const [code, setCode] = useState('');

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		try {
			const result = await verifyLogin(mfaToken, code);
			onLoginSuccess?.(result);
		} catch {
			// Surfaced via `error` from useMfaLogin.
		}
	};

	return (
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>Two-factor authentication</h1>
			<p style={styles.body}>Enter the 6-digit code from your authenticator app.</p>

			<label htmlFor="fonderie-mfa-code" style={styles.visuallyHidden}>
				Authentication code
			</label>
			<input
				id="fonderie-mfa-code"
				style={styles.input}
				type="text"
				inputMode="numeric"
				placeholder="6-digit code"
				value={code}
				onChange={(event) => setCode(event.target.value)}
				autoComplete="one-time-code"
				required
			/>

			{error && (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			)}

			<button type="submit" disabled={isLoading} style={styles.button}>
				{isLoading ? 'Verifying…' : 'Verify'}
			</button>

			<button type="button" onClick={onNavigateToLogin} style={styles.link}>
				Back to sign in
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
	visuallyHidden: {
		position: 'absolute',
		width: 1,
		height: 1,
		overflow: 'hidden',
		clip: 'rect(0 0 0 0)',
	},
};
