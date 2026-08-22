import type { IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { useMembers, useRemoveMember } from '@fonderie/vue-workspaces';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
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
		const { members, isLoading, error, refresh } = useMembers(props.client);
		const {
			removeMember,
			isLoading: isRemoving,
			error: removeError,
		} = useRemoveMember(props.client);

		async function handleRemove(userId: string) {
			try {
				await removeMember(userId);
				await refresh();
			} catch {
				// Surfaced via removeError.
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
			if (error.value)
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
