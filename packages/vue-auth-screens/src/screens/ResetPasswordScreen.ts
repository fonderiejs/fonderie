import type { AuthClient } from '@fonderie/client';
import { useResetPassword } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const ResetPasswordScreen = defineComponent({
	name: 'FonderieResetPasswordScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
		// Pre-fills the pin input, e.g. when it arrives via a deep link.
		initialPin: { type: String, required: false },
	},
	emits: {
		'reset-success': () => true,
		'navigate-login': () => true,
	},
	setup(props, { emit }) {
		const { resetPassword, isLoading, error, done } = useResetPassword(props.client);
		const pin = ref(props.initialPin ?? '');
		const password = ref('');
		const confirmPassword = ref('');
		const mismatch = ref(false);

		async function handleSubmit(event: Event) {
			event.preventDefault();
			if (password.value !== confirmPassword.value) {
				mismatch.value = true;
				return;
			}
			mismatch.value = false;
			try {
				await resetPassword({ pin: pin.value, password: password.value });
				emit('reset-success');
			} catch {
				// Surfaced via `error` from useResetPassword.
			}
		}

		return () => {
			if (done.value) {
				return h('div', { style: styles.container }, [
					h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Password updated'),
					h(
						'p',
						{ style: styles.body },
						'Your password has been reset. Sign in with your new password.',
					),
					h(
						'button',
						{ type: 'button', style: styles.button, onClick: () => emit('navigate-login') },
						'Go to sign in',
					),
				]);
			}

			return h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Choose a new password'),
				h(
					'p',
					{ style: styles.body },
					'Enter the 6-digit code from your email and your new password.',
				),
				h('input', {
					style: styles.input,
					type: 'text',
					inputmode: 'numeric',
					placeholder: '6-digit code',
					value: pin.value,
					required: true,
					autocomplete: 'one-time-code',
					onInput: (event: Event) => {
						pin.value = (event.target as HTMLInputElement).value;
					},
				}),
				h('input', {
					style: styles.input,
					type: 'password',
					placeholder: 'New password',
					value: password.value,
					required: true,
					autocomplete: 'new-password',
					onInput: (event: Event) => {
						password.value = (event.target as HTMLInputElement).value;
					},
				}),
				h('input', {
					style: styles.input,
					type: 'password',
					placeholder: 'Confirm new password',
					value: confirmPassword.value,
					required: true,
					autocomplete: 'new-password',
					onInput: (event: Event) => {
						confirmPassword.value = (event.target as HTMLInputElement).value;
					},
				}),
				mismatch.value
					? h('p', { style: styles.error, role: 'alert' }, 'Passwords do not match.')
					: null,
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? 'Resetting…' : 'Reset password',
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
					'Back to sign in',
				),
			]);
		};
	},
});
