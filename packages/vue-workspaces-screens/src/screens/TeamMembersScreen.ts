import type {
	FonderieApiError,
	IMemberDTO,
	UiMessageKey,
	WorkspacesClient,
} from '@fonderie/client';
import { formatPersonName } from '@fonderie/client';
import { useUiError, useUiLocale, useUiT } from '@fonderie/vue';
import { useMembers } from '@fonderie/vue-workspaces';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const TeamMembersScreen = defineComponent({
	name: 'FonderieTeamMembersScreen',
	props: {
		client: { type: Object as PropType<WorkspacesClient>, required: false },
		currentUserId: { type: String, required: true },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'navigate-invite': () => true,
	},
	setup(props, { emit }) {
		const { members, isLoading, error, removeMember } = useMembers(props.client);
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
		const uiLocale = useUiLocale(props.client, () => props.locale);
		// The member's name in the order the UI language writes it; their email when
		// they have no name; the id only as a last resort.
		const nameOf = (m: IMemberDTO) => formatPersonName(m.firstName, m.lastName, uiLocale.value) || m.email || m.userId;
		const rolesOf = (m: IMemberDTO) => (m.roles?.length ? m.roles.map((r) => roleLabel(r.name)) : [roleLabel(m.roleName)]).join(', ');
		// System roles are translated; a custom role shows its own name.
		const roleLabel = (roleName: string) => {
			const key = `workspaces.roles.${roleName}` as UiMessageKey;
			const text = t(key);
			return text === key ? roleName : text;
		};
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
					h('p', { style: styles.userId }, nameOf(member)),
					nameOf(member) !== member.email && member.email ? h('p', { style: styles.role }, member.email) : null,
					h('p', { style: styles.role }, rolesOf(member)),
				]),
				member.userId !== props.currentUserId
					? h(
							'button',
							{
								type: 'button',
								disabled: isRemoving.value,
								style: styles.removeButton,
								'aria-label': t('workspaces.members.a11y.remove', { member: nameOf(member) }),
								onClick: () => handleRemove(member.userId),
							},
							t('workspaces.members.remove'),
						)
					: null,
			]);
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, t('workspaces.members.loading'));
			// A failed removal also lands in the composable's shared `error`; it's
			// surfaced inline via `removeError` below, so don't let it replace the list.
			if (error.value && !removeError.value)
				return h('p', { style: styles.error, role: 'alert' }, errorText(error.value));

			return h('div', { style: styles.container }, [
				h('div', { style: styles.header }, [
					h('h1', { style: styles.title }, t('workspaces.members.title')),
					h(
						'button',
						{ type: 'button', style: styles.inviteButton, onClick: () => emit('navigate-invite') },
						t('workspaces.members.invite'),
					),
				]),
				removeError.value
					? h('p', { style: styles.error, role: 'alert' }, errorText(removeError.value))
					: null,
				h('ul', { style: styles.list }, members.value.map(renderRow)),
			]);
		};
	},
});
