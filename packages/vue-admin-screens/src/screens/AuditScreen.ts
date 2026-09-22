import type { AuditAdminClient, IAdminAuditQuery } from '@fonderie/client';
import { useAdminAudit } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { refreshButton, table, td } from './common';

// What happened — every workspace unless one is named. The chain's integrity
// verdict is on the Doctor page (events.integrity).
export const AuditScreen = defineComponent({
	name: 'FonderieAuditScreen',
	props: {
		client: { type: Object as PropType<AuditAdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
	},
	setup(props) {
		const draft = ref({ workspaceId: '', type: '', actorId: '' });
		const query = ref<Omit<IAdminAuditQuery, 'cursor'>>({ limit: props.pageSize });
		const { events, hasMore, isLoading, error, refresh, loadMore } = useAdminAudit(
			props.client,
			query,
		);
		const field = (key: 'workspaceId' | 'type' | 'actorId', placeholder: string) =>
			h('input', {
				value: draft.value[key],
				onInput: (e: Event) =>
					(draft.value = { ...draft.value, [key]: (e.target as HTMLInputElement).value }),
				placeholder,
				style: { ...styles.button, cursor: 'text' },
				'aria-label': placeholder,
			});
		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Audit'),
				h(
					'form',
					{
						style: styles.toolbar,
						onSubmit: (e: Event) => {
							e.preventDefault();
							const d = draft.value;
							query.value = {
								limit: props.pageSize,
								...(d.workspaceId.trim() ? { workspaceId: d.workspaceId.trim() } : {}),
								...(d.type.trim() ? { type: d.type.trim() } : {}),
								...(d.actorId.trim() ? { actorId: d.actorId.trim() } : {}),
							};
						},
					},
					[
						field('workspaceId', 'workspace id (all if empty)'),
						field('type', 'event type'),
						field('actorId', 'actor id'),
						h(
							'button',
							{ type: 'submit', style: styles.button, disabled: isLoading.value },
							'Filter',
						),
						refreshButton('Refresh', isLoading.value, () => void refresh()),
					],
				),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				events.value.length === 0 && !isLoading.value
					? h('p', { style: styles.muted }, 'Nothing recorded for this filter.')
					: table(
							['When', 'Type', 'Workspace', 'Actor', 'Request'],
							events.value.map((e) =>
								h('tr', { key: e.id }, [
									td(new Date(e.createdAt).toLocaleString(), styles.muted),
									td(e.type, styles.mono),
									td(String(e.payload['workspaceId'] ?? '—'), styles.mono),
									td(e.actorId ?? '—', styles.mono),
									td(e.requestId ?? '', styles.muted),
								]),
							),
						),
				isLoading.value ? h('p', { style: styles.status }, 'Loading…') : null,
				hasMore.value && !isLoading.value
					? h(
							'button',
							{
								type: 'button',
								style: { ...styles.button, marginTop: '8px' },
								onClick: () => void loadMore(),
							},
							'Load more',
						)
					: null,
			]);
	},
});
