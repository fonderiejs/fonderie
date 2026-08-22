import type { AuthClient } from '@fonderie/client';
import { useResetPassword } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

export interface IResetPasswordScreenProps {
	client?: AuthClient;
	// Pre-fills the pin input, e.g. when it arrives via a deep link.
	initialPin?: string;
	onResetSuccess?: () => void;
	onNavigateToLogin?: () => void;
}

export function ResetPasswordScreen({
	client,
	initialPin,
	onResetSuccess,
	onNavigateToLogin,
}: IResetPasswordScreenProps) {
	const { resetPassword, isLoading, error, done } = useResetPassword(client);
	const [pin, setPin] = useState(initialPin ?? '');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [mismatch, setMismatch] = useState(false);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
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
			<div style={styles.container}>
				<h1 style={styles.title}>Password updated</h1>
				<p style={styles.body}>Your password has been reset. Sign in with your new password.</p>
				<button type="button" onClick={onNavigateToLogin} style={styles.button}>
					Go to sign in
				</button>
			</div>
		);
	}

	return (
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>Choose a new password</h1>
			<p style={styles.body}>Enter the 6-digit code from your email and your new password.</p>

			<label htmlFor="fonderie-reset-pin" style={styles.visuallyHidden}>
				Reset code
			</label>
			<input
				id="fonderie-reset-pin"
				style={styles.input}
				type="text"
				inputMode="numeric"
				placeholder="6-digit code"
				value={pin}
				onChange={(event) => setPin(event.target.value)}
				autoComplete="one-time-code"
				required
			/>

			<label htmlFor="fonderie-reset-password" style={styles.visuallyHidden}>
				New password
			</label>
			<input
				id="fonderie-reset-password"
				style={styles.input}
				type="password"
				placeholder="New password"
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				autoComplete="new-password"
				required
			/>

			<label htmlFor="fonderie-reset-confirm-password" style={styles.visuallyHidden}>
				Confirm new password
			</label>
			<input
				id="fonderie-reset-confirm-password"
				style={styles.input}
				type="password"
				placeholder="Confirm new password"
				value={confirmPassword}
				onChange={(event) => setConfirmPassword(event.target.value)}
				autoComplete="new-password"
				required
			/>

			{mismatch && (
				<p style={styles.error} role="alert">
					Passwords do not match.
				</p>
			)}

			{error && (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			)}

			<button type="submit" disabled={isLoading} style={styles.button}>
				{isLoading ? 'Resetting…' : 'Reset password'}
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
