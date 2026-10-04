import type { IInvitationDTO, UiMessageKey, WorkspacesClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/vue';
import { useInvitations } from '@fonderie/vue-workspaces';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const InviteMembersScreen = defineComponent({
	name: 'FonderieInviteMembersScreen',
	props: {
		client: { type: Object as PropType<WorkspacesClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'navigate-members': () => true,
	},
	setup(props, { emit }) {
		const { invitations, isLoading, error, invite, cancelInvitation } = useInvitations(
			props.client,
		);
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
		// A status Fonderie does not know shows as sent by the server.
		const statusLabel = (status: string) => {
			const key = `workspaces.invitationStatus.${status}` as UiMessageKey;
			const text = t(key);
			return text === key ? status : text;
		};
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
					h('p', { style: styles.meta }, statusLabel(inv.status)),
				]),
				h(
					'button',
					{
						type: 'button',
						style: styles.cancelButton,
						'aria-label': t('workspaces.invite.a11y.cancel', { email: inv.email }),
						onClick: () => cancelInvitation(inv.id),
					},
					t('workspaces.invite.cancel'),
				),
			]);
		}

		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, t('workspaces.invite.title')),
				h('form', { style: styles.form, onSubmit: handleSubmit }, [
					h('input', {
						style: styles.input,
						type: 'email',
						placeholder: t('workspaces.invite.email'),
						'aria-label': t('workspaces.invite.email'),
						value: email.value,
						required: true,
						onInput: (e: Event) => {
							email.value = (e.target as HTMLInputElement).value;
						},
					}),
					h(
						'button',
						{ type: 'submit', disabled: isInviting.value, style: styles.button },
						isInviting.value ? t('workspaces.invite.submitting') : t('workspaces.invite.submit'),
					),
				]),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, errorText(error.value))
					: null,
				h('h2', { style: styles.subtitle }, t('workspaces.invite.pending')),
				isLoading.value
					? h('p', { style: styles.status }, t('workspaces.invite.loading'))
					: h('ul', { style: styles.list }, invitations.value.map(renderInvitation)),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-members') },
					t('workspaces.invite.backToTeam'),
				),
			]);
	},
});
