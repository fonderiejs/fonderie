import type { AuthClient, ILoginResult } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/vue';
import { useMfaLogin } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const MfaChallengeScreen = defineComponent({
	name: 'FonderieMfaChallengeScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
		// The temporary token from a login that returned MFA_REQUIRED.
		mfaToken: { type: String, required: true },
	},
	emits: {
		'login-success': (_result: ILoginResult) => true,
		'navigate-login': () => true,
	},
	setup(props, { emit }) {
		const { verifyLogin, isLoading, error } = useMfaLogin(props.client);
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
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
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, t('auth.mfa.title')),
				h('p', { style: styles.body }, t('auth.mfa.lead')),
				h('input', {
					style: styles.input,
					type: 'text',
					inputmode: 'numeric',
					placeholder: t('auth.fields.code'),
					value: code.value,
					required: true,
					autocomplete: 'one-time-code',
					onInput: (event: Event) => {
						code.value = (event.target as HTMLInputElement).value;
					},
				}),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, errorText(error.value))
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? t('auth.mfa.submitting') : t('auth.mfa.submit'),
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
					t('auth.backToSignIn'),
				),
			]);
	},
});
