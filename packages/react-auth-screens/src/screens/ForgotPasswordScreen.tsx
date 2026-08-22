import type { AuthClient } from '@fonderie/client';
import { useForgotPassword } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface IForgotPasswordScreenProps {
	client?: AuthClient;
	onNavigateToLogin?: () => void;
}

export function ForgotPasswordScreen({ client, onNavigateToLogin }: IForgotPasswordScreenProps) {
	const { forgotPassword, isLoading, error, sent } = useForgotPassword(client);
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
				<h1 style={styles.title}>Check your email</h1>
				<p style={styles.body}>
					If an account exists for {email}, we've sent instructions to reset your password.
				</p>
				<button type="button" onClick={onNavigateToLogin} style={styles.link}>
					Back to sign in
				</button>
			</div>
		);
	}

	return (
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>Reset your password</h1>
			<p style={styles.body}>Enter your email and we'll send you a link to reset your password.</p>

			<input
				style={styles.input}
				type="email"
				placeholder="Email"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				autoComplete="email"
				required
			/>

			{error && (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			)}

			<button type="submit" disabled={isLoading} style={styles.button}>
				{isLoading ? 'Sending…' : 'Send reset link'}
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
};
