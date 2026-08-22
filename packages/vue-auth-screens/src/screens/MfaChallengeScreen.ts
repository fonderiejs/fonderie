import type { AuthClient, ILoginResult } from '@fonderie/client';
import { useMfaLogin } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const MfaChallengeScreen = defineComponent({
	name: 'FonderieMfaChallengeScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
		// The temporary token from a login that returned MFA_REQUIRED.
		mfaToken: { type: String, required: true },
	},
	emits: {
		'login-success': (_result: ILoginResult) => true,
		'navigate-login': () => true,
	},
	setup(props, { emit }) {
		const { verifyLogin, isLoading, error } = useMfaLogin(props.client);
		const code = ref('');

		async function handleSubmit(event: Event) {
			event.preventDefault();
			try {
				const result = await verifyLogin(props.mfaToken, code.value);
				emit('login-success', result);
			} catch {
				// Surfaced via `error` from useMfaLogin.
			}
		}

		return () =>
			h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Two-factor authentication'),
				h('p', { style: styles.body }, 'Enter the 6-digit code from your authenticator app.'),
				h('input', {
					style: styles.input,
					type: 'text',
					inputmode: 'numeric',
					placeholder: '6-digit code',
					value: code.value,
					required: true,
					autocomplete: 'one-time-code',
					onInput: (event: Event) => {
						code.value = (event.target as HTMLInputElement).value;
					},
				}),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? 'Verifying…' : 'Verify',
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
					'Back to sign in',
				),
			]);
	},
});
