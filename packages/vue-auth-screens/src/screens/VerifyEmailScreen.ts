import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/vue';
import { useVerifyEmail } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const VerifyEmailScreen = defineComponent({
	name: 'FonderieVerifyEmailScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		verified: (_result: IVerifyEmailResult) => true,
	},
	setup(props, { emit }) {
		const { verifyEmail, resend, resent, isLoading, error } = useVerifyEmail(props.client);
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
		const code = ref('');

		async function handleSubmit(event: Event) {
			event.preventDefault();
			try {
				const result = await verifyEmail(code.value);
				emit('verified', result);
			} catch {
				// Surfaced via `error` from useVerifyEmail.
			}
		}

		async function handleResend() {
			try {
				await resend();
			} catch {
				// Surfaced via `error` from useVerifyEmail.
			}
		}

		return () =>
			h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, t('auth.verify.title')),
				h('p', { style: styles.body }, t('auth.verify.lead')),
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
					isLoading.value ? t('auth.verify.submitting') : t('auth.verify.submit'),
				),
				resent.value
					? h('p', { style: styles.sent }, t('auth.verify.resent'))
					: h(
							'button',
							{
								type: 'button',
								disabled: isLoading.value,
								style: styles.link,
								onClick: handleResend,
							},
							`${t('auth.verify.noCode')} ${t('auth.verify.resend')}`,
						),
			]);
	},
});
