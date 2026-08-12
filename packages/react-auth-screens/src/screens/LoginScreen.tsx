import type { AuthClient, ILoginResult } from '@fonderie/client';
import { useLogin } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface ILoginScreenProps {
	client: AuthClient;
	onLoginSuccess?: (result: ILoginResult) => void;
	onNavigateToRegister?: () => void;
	onNavigateToForgotPassword?: () => void;
}

export function LoginScreen({
	client,
	onLoginSuccess,
	onNavigateToRegister,
	onNavigateToForgotPassword,
}: ILoginScreenProps) {
	const { login, isLoading, error } = useLogin(client);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		try {
			const result = await login({ email, password });
			onLoginSuccess?.(result);
		} catch {
			// Surfaced via `error` from useLogin.
		}
	};

	return (
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>Sign In</h1>

			<label htmlFor="fonderie-login-email" style={styles.visuallyHidden}>
				Email
			</label>
			<input
				id="fonderie-login-email"
				style={styles.input}
				type="email"
				placeholder="Email"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				autoComplete="email"
				required
			/>

			<label htmlFor="fonderie-login-password" style={styles.visuallyHidden}>
				Password
			</label>
			<input
				id="fonderie-login-password"
				style={styles.input}
				type="password"
				placeholder="Password"
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				autoComplete="current-password"
				required
			/>

			{error && (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			)}

			<button type="submit" disabled={isLoading} style={styles.button}>
				{isLoading ? 'Signing in…' : 'Sign In'}
			</button>

			<button type="button" onClick={onNavigateToForgotPassword} style={styles.link}>
				Forgot password?
			</button>

			<button type="button" onClick={onNavigateToRegister} style={styles.link}>
				Don't have an account? <strong>Sign up</strong>
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
	visuallyHidden: {
		position: 'absolute',
		width: 1,
		height: 1,
		overflow: 'hidden',
		clip: 'rect(0 0 0 0)',
	},
};
