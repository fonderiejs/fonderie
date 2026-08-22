import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { useVerifyEmail } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const VerifyEmailScreen = defineComponent({
	name: 'FonderieVerifyEmailScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
	},
	emits: {
		verified: (_result: IVerifyEmailResult) => true,
	},
	setup(props, { emit }) {
		const { verifyEmail, resend, resent, isLoading, error } = useVerifyEmail(props.client);
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
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Verify your email'),
				h('p', { style: styles.body }, 'Enter the 6-digit code we sent to your email address.'),
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
				resent.value
					? h('p', { style: styles.sent }, 'A new verification email has been sent.')
					: h(
							'button',
							{
								type: 'button',
								disabled: isLoading.value,
								style: styles.link,
								onClick: handleResend,
							},
							"Didn't get a code? Resend email",
						),
			]);
	},
});
