import type { AuthClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/vue';
import { useForgotPassword } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const ForgotPasswordScreen = defineComponent({
	name: 'FonderieForgotPasswordScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'navigate-login': () => true,
	},
	setup(props, { emit }) {
		const { forgotPassword, isLoading, error, sent } = useForgotPassword(props.client);
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
		const email = ref('');

		async function handleSubmit(event: Event) {
			event.preventDefault();
			try {
				await forgotPassword(email.value);
			} catch {
				// Surfaced via `error` from useForgotPassword.
			}
		}

		return () => {
			if (sent.value) {
				return h('div', { style: styles.container }, [
					h('h1', { style: [styles.title, { marginBottom: '12px' }] }, t('auth.forgot.sentTitle')),
					h('p', { style: styles.body }, t('auth.forgot.sentBody', { email: email.value })),
					h(
						'button',
						{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
						t('auth.backToSignIn'),
					),
				]);
			}

			return h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, t('auth.forgot.title')),
				h('p', { style: styles.body }, t('auth.forgot.lead')),
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
				error.value
					? h('p', { style: styles.error, role: 'alert' }, errorText(error.value))
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? t('auth.forgot.submitting') : t('auth.forgot.submit'),
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
					t('auth.backToSignIn'),
				),
			]);
		};
	},
});
