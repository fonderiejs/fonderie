import type { AuthClient } from '@fonderie/client';
import { useForgotPassword } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const ForgotPasswordScreen = defineComponent({
	name: 'FonderieForgotPasswordScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
	},
	emits: {
		'navigate-login': () => true,
	},
	setup(props, { emit }) {
		const { forgotPassword, isLoading, error, sent } = useForgotPassword(props.client);
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
					h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Check your email'),
					h(
						'p',
						{ style: styles.body },
						`If an account exists for ${email.value}, we've sent instructions to reset your password.`,
					),
					h(
						'button',
						{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
						'Back to sign in',
					),
				]);
			}

			return h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Reset your password'),
				h(
					'p',
					{ style: styles.body },
					"Enter your email and we'll send you a link to reset your password.",
				),
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
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? 'Sending…' : 'Send reset link',
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
