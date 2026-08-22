import type { FonderieApiError, IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { useMembers } from '@fonderie/vue-workspaces';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const TeamMembersScreen = defineComponent({
	name: 'FonderieTeamMembersScreen',
	props: {
		client: { type: Object as PropType<WorkspacesClient>, required: false },
		currentUserId: { type: String, required: true },
	},
	emits: {
		'navigate-invite': () => true,
	},
	setup(props, { emit }) {
		const { members, isLoading, error, removeMember } = useMembers(props.client);
		const isRemoving = ref(false);
		const removeError = ref<FonderieApiError | null>(null);

		async function handleRemove(userId: string) {
			isRemoving.value = true;
			removeError.value = null;
			try {
				// The list composable re-fetches members itself after the write.
				await removeMember(userId);
			} catch (err) {
				// useMembers normalizes every failure to FonderieApiError before throwing.
				removeError.value = err as FonderieApiError;
			} finally {
				isRemoving.value = false;
			}
		}

		function renderRow(member: IMemberDTO) {
			return h('li', { key: member.userId, style: styles.row }, [
				h('div', [
					h('p', { style: styles.userId }, member.userId),
					h('p', { style: styles.role }, member.roleName),
				]),
				member.userId !== props.currentUserId
					? h(
							'button',
							{
								type: 'button',
								disabled: isRemoving.value,
								style: styles.removeButton,
								onClick: () => handleRemove(member.userId),
							},
							'Remove',
						)
					: null,
			]);
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, 'Loading team…');
			// A failed removal also lands in the composable's shared `error`; it's
			// surfaced inline via `removeError` below, so don't let it replace the list.
			if (error.value && !removeError.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('div', { style: styles.header }, [
					h('h1', { style: styles.title }, 'Team members'),
					h(
						'button',
						{ type: 'button', style: styles.inviteButton, onClick: () => emit('navigate-invite') },
						'Invite',
					),
				]),
				removeError.value
					? h('p', { style: styles.error, role: 'alert' }, removeError.value.explanation)
					: null,
				h('ul', { style: styles.list }, members.value.map(renderRow)),
			]);
		};
	},
});
