import type { AuthClient, IRegisterResult } from '@fonderie/client';
import { useRegister } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const RegisterScreen = defineComponent({
	name: 'FonderieRegisterScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: true },
	},
	emits: {
		'register-success': (_result: IRegisterResult) => true,
		'navigate-login': () => true,
	},
	setup(props, { emit }) {
		const { register, isLoading, error } = useRegister(props.client);
		const email = ref('');
		const password = ref('');
		const firstName = ref('');
		const lastName = ref('');
		const validationError = ref<string | null>(null);

		function bind(target: typeof email) {
			return (event: Event) => {
				target.value = (event.target as HTMLInputElement).value;
			};
		}

		async function handleSubmit(event: Event) {
			event.preventDefault();
			validationError.value = null;
			if (!EMAIL_PATTERN.test(email.value)) {
				validationError.value = 'Enter a valid email address.';
				return;
			}
			if (password.value.length < MIN_PASSWORD_LENGTH) {
				validationError.value = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
				return;
			}
			try {
				const result = await register({
					email: email.value,
					password: password.value,
					firstName: firstName.value,
					lastName: lastName.value,
				});
				emit('register-success', result);
			} catch {
				// Surfaced via `error` from useRegister.
			}
		}

		return () =>
			h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: styles.title }, 'Create Account'),
				h('input', {
					style: styles.input,
					type: 'text',
					placeholder: 'First name',
					value: firstName.value,
					autocomplete: 'given-name',
					onInput: bind(firstName),
				}),
				h('input', {
					style: styles.input,
					type: 'text',
					placeholder: 'Last name',
					value: lastName.value,
					autocomplete: 'family-name',
					onInput: bind(lastName),
				}),
				h('input', {
					style: styles.input,
					type: 'email',
					placeholder: 'Email',
					value: email.value,
					required: true,
					autocomplete: 'email',
					onInput: bind(email),
				}),
				h('input', {
					style: styles.input,
					type: 'password',
					placeholder: 'Password',
					value: password.value,
					required: true,
					minlength: MIN_PASSWORD_LENGTH,
					autocomplete: 'new-password',
					onInput: bind(password),
				}),
				validationError.value || error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							validationError.value ?? error.value?.explanation,
						)
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? 'Creating account…' : 'Create Account',
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
					'Already have an account? Sign in',
				),
			]);
	},
});
