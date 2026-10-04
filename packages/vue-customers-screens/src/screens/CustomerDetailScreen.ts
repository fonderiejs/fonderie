import type {
	CustomersClient,
	ICustomerEmailDTO,
	ICustomerNoteDTO,
	ICustomerPhoneDTO,
} from '@fonderie/client';
import { useUiT } from '@fonderie/vue';
import {
	useCustomer,
	useCustomerEmails,
	useCustomerNotes,
	useCustomerPhones,
	useCustomerTags,
} from '@fonderie/vue-customers';
import type { PropType } from 'vue';
import { defineComponent, h, ref, watch } from 'vue';
import { styles } from '../styles';

export const CustomerDetailScreen = defineComponent({
	name: 'FonderieCustomerDetailScreen',
	props: {
		client: { type: Object as PropType<CustomersClient>, required: false },
		customerId: { type: String, required: true },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'navigate-list': () => true,
	},
	setup(props, { emit }) {
		const t = useUiT(props.client, () => props.locale);
		const customerBound = useCustomer(props.client, props.customerId, 1);
		const emailsBound = useCustomerEmails(props.client, props.customerId);
		const phonesBound = useCustomerPhones(props.client, props.customerId);
		const notesBound = useCustomerNotes(props.client, props.customerId);
		const tagsBound = useCustomerTags(props.client, props.customerId);

		const firstName = ref('');
		const lastName = ref('');
		const companyName = ref('');
		const newEmail = ref('');
		const newPhone = ref('');
		const newNote = ref('');
		const newTag = ref('');

		watch(
			() => customerBound.customer.value,
			(c) => {
				if (!c) return;
				firstName.value = c.firstName;
				lastName.value = c.lastName;
				companyName.value = c.companyName;
			},
		);

		async function handleSaveProfile(event: Event) {
			event.preventDefault();
			try {
				await customerBound.updateCustomer({
					firstName: firstName.value,
					lastName: lastName.value,
					companyName: companyName.value,
				});
			} catch {
				// Surfaced via error.
			}
		}

		async function handleAddEmail() {
			if (!newEmail.value.trim()) return;
			try {
				await emailsBound.addEmail({ email: newEmail.value.trim() });
				newEmail.value = '';
			} catch {
				// Surfaced via error.
			}
		}

		async function handleAddPhone() {
			if (!newPhone.value.trim()) return;
			try {
				await phonesBound.addPhone({ phone: newPhone.value.trim() });
				newPhone.value = '';
			} catch {
				// Surfaced via error.
			}
		}

		async function handleAddNote() {
			if (!newNote.value.trim()) return;
			try {
				await notesBound.createNote(newNote.value.trim());
				newNote.value = '';
			} catch {
				// Surfaced via error.
			}
		}

		async function handleAddTag() {
			if (!newTag.value.trim()) return;
			try {
				await tagsBound.addTag(newTag.value.trim());
				newTag.value = '';
			} catch {
				// Surfaced via error.
			}
		}

		function renderEmail(email: ICustomerEmailDTO) {
			return h('li', { key: email.id, style: styles.detailRow }, [
				h('span', {}, [
					email.email,
					email.isPrimary
						? h('em', { style: styles.primary }, t('customers.detail.primary'))
						: null,
				]),
				h('span', { style: styles.rowActions }, [
					!email.isPrimary
						? h(
								'button',
								{
									type: 'button',
									style: styles.smallButton,
									onClick: () => emailsBound.setPrimaryEmail(email.id),
								},
								t('customers.detail.makePrimary'),
							)
						: null,
					h(
						'button',
						{
							type: 'button',
							style: styles.smallButton,
							onClick: () => emailsBound.removeEmail(email.id),
						},
						t('customers.detail.remove'),
					),
				]),
			]);
		}

		function renderPhone(phone: ICustomerPhoneDTO) {
			return h('li', { key: phone.id, style: styles.detailRow }, [
				h('span', {}, [
					phone.phone,
					phone.isPrimary
						? h('em', { style: styles.primary }, t('customers.detail.primary'))
						: null,
				]),
				h('span', { style: styles.rowActions }, [
					!phone.isPrimary
						? h(
								'button',
								{
									type: 'button',
									style: styles.smallButton,
									onClick: () => phonesBound.setPrimaryPhone(phone.id),
								},
								t('customers.detail.makePrimary'),
							)
						: null,
					h(
						'button',
						{
							type: 'button',
							style: styles.smallButton,
							onClick: () => phonesBound.removePhone(phone.id),
						},
						t('customers.detail.remove'),
					),
				]),
			]);
		}

		function renderNote(note: ICustomerNoteDTO) {
			return h('li', { key: note.id, style: styles.noteRow }, [
				h('p', { style: styles.noteBody }, note.body),
				h(
					'button',
					{
						type: 'button',
						style: styles.smallButton,
						onClick: () => notesBound.deleteNote(note.id),
					},
					t('customers.detail.delete'),
				),
			]);
		}

		return () => {
			if (customerBound.isLoading.value)
				return h('p', { style: styles.status }, t('customers.loading'));
			if (customerBound.error.value)
				return h(
					'p',
					{ style: styles.error, role: 'alert' },
					customerBound.error.value.explanation,
				);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, t('customers.detail.title')),

				h('form', { style: styles.editForm, onSubmit: handleSaveProfile }, [
					h('input', {
						style: styles.input,
						placeholder: t('customers.fields.firstName'),
						value: firstName.value,
						onInput: (e: Event) => {
							firstName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: t('customers.fields.lastName'),
						value: lastName.value,
						onInput: (e: Event) => {
							lastName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: t('customers.fields.company'),
						value: companyName.value,
						onInput: (e: Event) => {
							companyName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'submit', style: styles.button }, t('customers.detail.save')),
				]),

				h('h2', { style: styles.subtitle }, t('customers.detail.emails')),
				h('ul', { style: styles.list }, emailsBound.emails.value.map(renderEmail)),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: t('customers.detail.emailPlaceholder'),
						value: newEmail.value,
						onInput: (e: Event) => {
							newEmail.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'button', style: styles.smallButton, onClick: handleAddEmail },
						t('customers.detail.add'),
					),
				]),

				h('h2', { style: styles.subtitle }, t('customers.detail.phones')),
				h('ul', { style: styles.list }, phonesBound.phones.value.map(renderPhone)),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: t('customers.detail.phonePlaceholder'),
						value: newPhone.value,
						onInput: (e: Event) => {
							newPhone.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'button', style: styles.smallButton, onClick: handleAddPhone },
						t('customers.detail.add'),
					),
				]),

				h('h2', { style: styles.subtitle }, t('customers.detail.tags')),
				h(
					'div',
					{ style: styles.tags },
					tagsBound.tags.value.map((tag) =>
						h(
							'button',
							{
								key: tag,
								type: 'button',
								style: styles.tag,
								'aria-label': t('customers.detail.a11y.removeTag', { tag }),
								onClick: () => tagsBound.removeTag(tag),
							},
							`${tag} ×`,
						),
					),
				),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: t('customers.detail.tagPlaceholder'),
						value: newTag.value,
						onInput: (e: Event) => {
							newTag.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'button', style: styles.smallButton, onClick: handleAddTag },
						t('customers.detail.add'),
					),
				]),

				h('h2', { style: styles.subtitle }, t('customers.detail.notes')),
				h('ul', { style: styles.list }, notesBound.notes.value.map(renderNote)),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: t('customers.detail.notePlaceholder'),
						value: newNote.value,
						onInput: (e: Event) => {
							newNote.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'button', style: styles.smallButton, onClick: handleAddNote },
						t('customers.detail.add'),
					),
				]),

				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-list') },
					t('customers.detail.backToList'),
				),
			]);
		};
	},
});
