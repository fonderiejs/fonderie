import type { AuthClient, IRegisterResult } from '@fonderie/client';
import { uiLocaleFor } from '@fonderie/client';
import { useFonderieSubClient, useUiError, useUiT } from '@fonderie/vue';
import { useRegister } from '@fonderie/vue-auth';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const RegisterScreen = defineComponent({
	name: 'FonderieRegisterScreen',
	props: {
		client: { type: Object as PropType<AuthClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'register-success': (_result: IRegisterResult) => true,
		'navigate-login': () => true,
	},
	setup(props, { emit }) {
		const { register, isLoading, error } = useRegister(props.client);
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
		// The new account's language: this screen's, else the client's UI language.
		const authClient = useFonderieSubClient(props.client, (c) => c.auth, 'RegisterScreen');
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
				validationError.value = t('auth.register.invalidEmail');
				return;
			}
			if (password.value.length < MIN_PASSWORD_LENGTH) {
				validationError.value = t('auth.register.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
				return;
			}
			const signUpLocale = props.locale ?? uiLocaleFor(authClient)?.get();
			try {
				const result = await register({
					email: email.value,
					password: password.value,
					firstName: firstName.value,
					lastName: lastName.value,
					...(signUpLocale ? { locale: signUpLocale } : {}),
				});
				emit('register-success', result);
			} catch {
				// Surfaced via `error` from useRegister.
			}
		}

		return () =>
			h('form', { style: styles.container, onSubmit: handleSubmit }, [
				h('h1', { style: styles.title }, t('auth.register.title')),
				h('input', {
					style: styles.input,
					type: 'text',
					placeholder: t('auth.fields.firstName'),
					value: firstName.value,
					autocomplete: 'given-name',
					onInput: bind(firstName),
				}),
				h('input', {
					style: styles.input,
					type: 'text',
					placeholder: t('auth.fields.lastName'),
					value: lastName.value,
					autocomplete: 'family-name',
					onInput: bind(lastName),
				}),
				h('input', {
					style: styles.input,
					type: 'email',
					placeholder: t('auth.fields.email'),
					value: email.value,
					required: true,
					autocomplete: 'email',
					onInput: bind(email),
				}),
				h('input', {
					style: styles.input,
					type: 'password',
					placeholder: t('auth.fields.password'),
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
							validationError.value ?? errorText(error.value),
						)
					: null,
				h(
					'button',
					{ type: 'submit', disabled: isLoading.value, style: styles.button },
					isLoading.value ? t('auth.register.submitting') : t('auth.register.submit'),
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-login') },
					`${t('auth.register.haveAccount')} ${t('auth.register.signIn')}`,
				),
			]);
	},
});
