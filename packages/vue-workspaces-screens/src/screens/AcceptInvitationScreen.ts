import type { WorkspacesClient } from '@fonderie/client';
import { useAcceptInvitation } from '@fonderie/vue-workspaces';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const AcceptInvitationScreen = defineComponent({
	name: 'FonderieAcceptInvitationScreen',
	props: {
		client: { type: Object as PropType<WorkspacesClient>, required: false },
		// The invitation pin/token from the invite email.
		token: { type: String, required: true },
	},
	emits: {
		accepted: (_workspaceId: string) => true,
		'navigate-back': () => true,
	},
	setup(props, { emit }) {
		const { acceptInvitation, isLoading, error } = useAcceptInvitation(props.client);
		const accepted = ref(false);

		async function handleAccept() {
			try {
				const workspaceId = await acceptInvitation(props.token);
				accepted.value = true;
				emit('accepted', workspaceId);
			} catch {
				// Surfaced via `error` from useAcceptInvitation.
			}
		}

		return () => {
			if (accepted.value) {
				return h('div', { style: styles.container }, [
					h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Invitation accepted'),
					h('p', { style: styles.body }, "You've joined the workspace."),
				]);
			}

			return h('div', { style: styles.container }, [
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, 'Workspace invitation'),
				h(
					'p',
					{ style: styles.body },
					"You've been invited to join a workspace. Accept the invitation to become a member.",
				),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h(
					'button',
					{
						type: 'button',
						disabled: isLoading.value,
						style: styles.primaryButton,
						onClick: handleAccept,
					},
					isLoading.value ? 'Accepting…' : 'Accept invitation',
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-back') },
					'Not now',
				),
			]);
		};
	},
});
