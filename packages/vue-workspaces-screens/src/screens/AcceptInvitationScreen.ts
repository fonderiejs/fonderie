import type { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/vue';
import { useWorkspaces } from '@fonderie/vue-workspaces';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const AcceptInvitationScreen = defineComponent({
	name: 'FonderieAcceptInvitationScreen',
	props: {
		client: { type: Object as PropType<WorkspacesClient>, required: false },
		// The token from the invitation link (…/invite/<token>) — not the PIN.
		token: { type: String, required: true },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		accepted: (_workspaceId: string) => true,
		'navigate-back': () => true,
	},
	setup(props, { emit }) {
		// Note: mounting useWorkspaces also fetches the workspace list; its shared
		// isLoading/error track that fetch, so the accept action keeps local state.
		const { acceptInvitation } = useWorkspaces(props.client);
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
		const accepted = ref(false);
		const isAccepting = ref(false);
		const acceptError = ref<FonderieApiError | null>(null);

		async function handleAccept() {
			isAccepting.value = true;
			acceptError.value = null;
			try {
				// acceptInvitation resolves to the joined workspace's id.
				const workspaceId = await acceptInvitation({ token: props.token });
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
					h(
						'h1',
						{ style: [styles.title, { marginBottom: '12px' }] },
						t('workspaces.accept.acceptedTitle'),
					),
					h('p', { style: styles.body }, t('workspaces.accept.acceptedBody')),
				]);
			}

			return h('div', { style: styles.container }, [
				h('h1', { style: [styles.title, { marginBottom: '12px' }] }, t('workspaces.accept.title')),
				h('p', { style: styles.body }, t('workspaces.accept.body')),
				acceptError.value
					? h('p', { style: styles.error, role: 'alert' }, errorText(acceptError.value))
					: null,
				h(
					'button',
					{
						type: 'button',
						disabled: isAccepting.value,
						style: styles.primaryButton,
						onClick: handleAccept,
					},
					isAccepting.value ? t('workspaces.accept.submitting') : t('workspaces.accept.submit'),
				),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-back') },
					t('workspaces.accept.notNow'),
				),
			]);
		};
	},
});
