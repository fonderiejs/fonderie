import type { AuthClient, IRegisterResult } from '@fonderie/client';
import { useRegister } from '@fonderie/react-auth';
import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface IRegisterScreenProps {
	client: AuthClient;
	onRegisterSuccess?: (result: IRegisterResult) => void;
	onNavigateToLogin?: () => void;
}

export function RegisterScreen({
	client,
	onRegisterSuccess,
	onNavigateToLogin,
}: IRegisterScreenProps) {
	const { register, isLoading, error } = useRegister(client);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setValidationError(null);
		if (!EMAIL_PATTERN.test(email)) {
			setValidationError('Enter a valid email address.');
			return;
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			setValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
			return;
		}
		try {
			const result = await register({ email, password, firstName, lastName });
			onRegisterSuccess?.(result);
		} catch {
			// Surfaced via `error` from useRegister.
		}
	};

	return (
		<form style={styles.container} onSubmit={handleSubmit}>
			<h1 style={styles.title}>Create Account</h1>

			<input
				style={styles.input}
				type="text"
				placeholder="First name"
				value={firstName}
				onChange={(event) => setFirstName(event.target.value)}
				autoComplete="given-name"
			/>

			<input
				style={styles.input}
				type="text"
				placeholder="Last name"
				value={lastName}
				onChange={(event) => setLastName(event.target.value)}
				autoComplete="family-name"
			/>

			<input
				style={styles.input}
				type="email"
				placeholder="Email"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				autoComplete="email"
				required
			/>

			<input
				style={styles.input}
				type="password"
				placeholder="Password"
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
				{isLoading ? 'Creating account…' : 'Create Account'}
			</button>

			<button type="button" onClick={onNavigateToLogin} style={styles.link}>
				Already have an account? <strong>Sign in</strong>
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
