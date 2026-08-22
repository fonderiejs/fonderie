import type { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useWorkspaces } from '@fonderie/vue-workspaces';
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
		// Note: mounting useWorkspaces also fetches the workspace list; its shared
		// isLoading/error track that fetch, so the accept action keeps local state.
		const { acceptInvitation } = useWorkspaces(props.client);
		const accepted = ref(false);
		const isAccepting = ref(false);
		const acceptError = ref<FonderieApiError | null>(null);

		async function handleAccept() {
			isAccepting.value = true;
			acceptError.value = null;
			try {
				// acceptInvitation resolves to the joined workspace's id.
				const workspaceId = await acceptInvitation(props.token);
				accepted.value = true;
				emit('accepted', workspaceId);
			} catch (err) {
				// useWorkspaces normalizes every failure to FonderieApiError before throwing.
				acceptError.value = err as FonderieApiError;
			} finally {
				isAccepting.value = false;
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
				acceptError.value
					? h('p', { style: styles.error, role: 'alert' }, acceptError.value.explanation)
					: null,
				h(
					'button',
					{
						type: 'button',
						disabled: isAccepting.value,
						style: styles.primaryButton,
						onClick: handleAccept,
					},
					isAccepting.value ? 'Accepting…' : 'Accept invitation',
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
