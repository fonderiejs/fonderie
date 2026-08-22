import type { IInvitationDTO, WorkspacesClient } from '@fonderie/client';
import { useInvitations } from '@fonderie/vue-workspaces';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const InviteMembersScreen = defineComponent({
	name: 'FonderieInviteMembersScreen',
	props: {
		client: { type: Object as PropType<WorkspacesClient>, required: false },
	},
	emits: {
		'navigate-members': () => true,
	},
	setup(props, { emit }) {
		const { invitations, isLoading, error, invite, cancelInvitation } = useInvitations(
			props.client,
		);
		const email = ref('');
		const isInviting = ref(false);

		async function handleSubmit(event: Event) {
			event.preventDefault();
			isInviting.value = true;
			try {
				await invite({ email: email.value });
				email.value = '';
			} catch {
				// Surfaced via error.
			} finally {
				isInviting.value = false;
			}
		}

		function renderInvitation(inv: IInvitationDTO) {
			return h('li', { key: inv.id, style: styles.row }, [
				h('div', [
					h('p', { style: styles.email }, inv.email),
					h('p', { style: styles.meta }, inv.status),
				]),
				h(
					'button',
					{ type: 'button', style: styles.cancelButton, onClick: () => cancelInvitation(inv.id) },
					'Cancel',
				),
			]);
		}

		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Invite members'),
				h('form', { style: styles.form, onSubmit: handleSubmit }, [
					h('input', {
						style: styles.input,
						type: 'email',
						placeholder: 'Email address',
						value: email.value,
						required: true,
						onInput: (e: Event) => {
							email.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'submit', disabled: isInviting.value, style: styles.button },
						isInviting.value ? 'Sending…' : 'Send invite',
					),
				]),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h('h2', { style: styles.subtitle }, 'Pending invitations'),
				isLoading.value
					? h('p', { style: styles.status }, 'Loading…')
					: h('ul', { style: styles.list }, invitations.value.map(renderInvitation)),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-members') },
					'Back to team',
				),
			]);
	},
});
