import type {
	CustomersClient,
	ICustomerEmailDTO,
	ICustomerNoteDTO,
	ICustomerPhoneDTO,
} from '@fonderie/client';
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
	},
	emits: {
		'navigate-list': () => true,
	},
	setup(props, { emit }) {
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
					email.isPrimary ? h('em', { style: styles.primary }, 'primary') : null,
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
								'Make primary',
							)
						: null,
					h(
						'button',
						{
							type: 'button',
							style: styles.smallButton,
							onClick: () => emailsBound.removeEmail(email.id),
						},
						'Remove',
					),
				]),
			]);
		}

		function renderPhone(phone: ICustomerPhoneDTO) {
			return h('li', { key: phone.id, style: styles.detailRow }, [
				h('span', {}, [
					phone.phone,
					phone.isPrimary ? h('em', { style: styles.primary }, 'primary') : null,
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
								'Make primary',
							)
						: null,
					h(
						'button',
						{
							type: 'button',
							style: styles.smallButton,
							onClick: () => phonesBound.removePhone(phone.id),
						},
						'Remove',
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
					'Delete',
				),
			]);
		}

		return () => {
			if (customerBound.isLoading.value) return h('p', { style: styles.status }, 'Loading…');
			if (customerBound.error.value)
				return h(
					'p',
					{ style: styles.error, role: 'alert' },
					customerBound.error.value.explanation,
				);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Customer'),

				h('form', { style: styles.editForm, onSubmit: handleSaveProfile }, [
					h('input', {
						style: styles.input,
						placeholder: 'First name',
						value: firstName.value,
						onInput: (e: Event) => {
							firstName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: 'Last name',
						value: lastName.value,
						onInput: (e: Event) => {
							lastName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: 'Company',
						value: companyName.value,
						onInput: (e: Event) => {
							companyName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'submit', style: styles.button }, 'Save'),
				]),

				h('h2', { style: styles.subtitle }, 'Emails'),
				h('ul', { style: styles.list }, emailsBound.emails.value.map(renderEmail)),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: 'new@email.com',
						value: newEmail.value,
						onInput: (e: Event) => {
							newEmail.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'button', style: styles.smallButton, onClick: handleAddEmail },
						'Add',
					),
				]),

				h('h2', { style: styles.subtitle }, 'Phones'),
				h('ul', { style: styles.list }, phonesBound.phones.value.map(renderPhone)),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: '+1 555 0100',
						value: newPhone.value,
						onInput: (e: Event) => {
							newPhone.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'button', style: styles.smallButton, onClick: handleAddPhone },
						'Add',
					),
				]),

				h('h2', { style: styles.subtitle }, 'Tags'),
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
								onClick: () => tagsBound.removeTag(tag),
							},
							`${tag} ×`,
						),
					),
				),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: 'new tag',
						value: newTag.value,
						onInput: (e: Event) => {
							newTag.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'button', style: styles.smallButton, onClick: handleAddTag }, 'Add'),
				]),

				h('h2', { style: styles.subtitle }, 'Notes'),
				h('ul', { style: styles.list }, notesBound.notes.value.map(renderNote)),
				h('div', { style: styles.inlineForm }, [
					h('input', {
						style: styles.inlineInput,
						placeholder: 'Add a note…',
						value: newNote.value,
						onInput: (e: Event) => {
							newNote.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'button', style: styles.smallButton, onClick: handleAddNote }, 'Add'),
				]),

				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-list') },
					'Back to customers',
				),
			]);
		};
	},
});
