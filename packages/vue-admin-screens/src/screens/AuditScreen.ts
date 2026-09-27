import type { AuditAdminClient, IAdminAuditQuery } from '@fonderie/client';
import { useAdminAudit } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { empty, icon, pageHeader } from '../ui';
import { loadMoreButton, refreshButton, table, td } from './common';

// What happened — every workspace unless one is named. The chain's integrity
// verdict is on the Doctor page (events.integrity).
export const AuditScreen = defineComponent({
	name: 'FonderieAuditScreen',
	props: {
		client: { type: Object as PropType<AuditAdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
	},
	setup(props) {
		const draft = ref({ workspaceId: '', type: '', actorId: '', from: '', to: '' });
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
				style: styles.input,
				'aria-label': placeholder,
			});
		return () =>
			h('div', { style: styles.container }, [
				pageHeader(
					'Audit',
					"What happened, across every workspace unless you name one. The chain's integrity verdict is on the Doctor page.",
				),
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
								// Dates are whole days in the operator's time zone: "to" includes that day.
								...(d.from ? { from: new Date(`${d.from}T00:00:00`) } : {}),
								...(d.to ? { to: new Date(`${d.to}T23:59:59.999`) } : {}),
							};
						},
					},
					[
						field('workspaceId', 'workspace id (all if empty)'),
						field('type', 'event type'),
						field('actorId', 'actor id'),
						...(['from', 'to'] as const).map((k) =>
							h('input', {
								type: 'date',
								value: draft.value[k],
								onInput: (e: Event) =>
									(draft.value = { ...draft.value, [k]: (e.target as HTMLInputElement).value }),
								style: styles.input,
								'aria-label': k === 'from' ? 'From date' : 'To date',
								title: k === 'from' ? 'From (inclusive)' : 'To (inclusive)',
							}),
						),
						h(
							'button',
							{ type: 'submit', style: styles.buttonPrimary, disabled: isLoading.value },
							[icon('search', 14), 'Filter'],
						),
						refreshButton('Refresh', isLoading.value, () => void refresh()),
					],
				),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				events.value.length === 0 && !isLoading.value
					? empty('Nothing recorded for this filter', undefined, 'audit')
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
				hasMore.value && !isLoading.value ? loadMoreButton(() => void loadMore()) : null,
			]);
	},
});
