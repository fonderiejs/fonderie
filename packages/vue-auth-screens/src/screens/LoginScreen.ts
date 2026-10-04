import type { AuthClient, ILoginResult } from '@fonderie/client';
import { isMfaRequired } from '@fonderie/client';
import { useUiT } from '@fonderie/vue';
import { useLogin } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const LoginScreen = defineComponent({
	name: 'FonderieLoginScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'login-success': (_result: ILoginResult) => true,
		'mfa-required': (_mfaToken: string) => true,
		'navigate-register': () => true,
		'navigate-forgot-password': () => true,
	},
	setup(props, { emit }) {
		const { login, isLoading, error } = useLogin(props.client);
		const t = useUiT(props.client, () => props.locale);
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
				h('h1', { style: styles.title }, t('auth.login.title')),
				h('input', {
					style: styles.input,
					type: 'email',
					placeholder: t('auth.fields.email'),
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
					placeholder: t('auth.fields.password'),
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
					isLoading.value ? t('auth.login.submitting') : t('auth.login.submit'),
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-forgot-password') },
					t('auth.login.forgotPassword'),
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-register') },
					`${t('auth.login.noAccount')} ${t('auth.login.signUp')}`,
				),
			]);
	},
});
