import type { AuthClient, ILoginResult } from '@fonderie/client';
import { isMfaRequired } from '@fonderie/client';
import { useLogin } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const LoginScreen = defineComponent({
	name: 'FonderieLoginScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
	},
	emits: {
		'login-success': (_result: ILoginResult) => true,
		'mfa-required': (_mfaToken: string) => true,
		'navigate-register': () => true,
		'navigate-forgot-password': () => true,
	},
	setup(props, { emit }) {
		const { login, isLoading, error } = useLogin(props.client);
		const email = ref('');
		const password = ref('');

		async function handleSubmit(event: Event) {
			event.preventDefault();
			try {
				const result = await login({ email: email.value, password: password.value });
				if (isMfaRequired(result)) {
					emit('mfa-required', result.mfaToken);
					return;
				}
				emit('login-success', result);
			} catch {
				// Surfaced via `error` from useLogin.
			}
		}

		return () =>
			h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: styles.title }, 'Sign In'),
				h('input', {
					style: styles.input,
					type: 'email',
					placeholder: 'Email',
					value: email.value,
					required: true,
					autocomplete: 'email',
					onInput: (event: Event) => {
						email.value = (event.target as HTMLInputElement).value;
					},
				}),
				h('input', {
					style: styles.input,
					type: 'password',
					placeholder: 'Password',
					value: password.value,
					required: true,
					autocomplete: 'current-password',
					onInput: (event: Event) => {
						password.value = (event.target as HTMLInputElement).value;
					},
				}),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? 'Signing in…' : 'Sign In',
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-forgot-password') },
					'Forgot password?',
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-register') },
					"Don't have an account? Sign up",
				),
			]);
	},
});
