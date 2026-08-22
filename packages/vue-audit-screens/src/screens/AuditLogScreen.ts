import type { AuditClient, IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { useAuditEvents } from '@fonderie/vue-audit';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';

const styles = {
	container: { padding: '24px', maxWidth: '640px' },
	title: { fontSize: '24px', fontWeight: 700, marginBottom: '16px' },
	form: { display: 'flex', gap: '8px', marginBottom: '16px' },
	input: {
		flex: '1',
		border: '1px solid #ddd',
		borderRadius: '8px',
		padding: '10px',
		fontSize: '14px',
	},
	filterButton: {
		backgroundColor: '#000',
		color: '#fff',
		padding: '0 16px',
		borderRadius: '8px',
		border: 'none',
		fontSize: '14px',
		fontWeight: 600,
		cursor: 'pointer',
	},
	status: { padding: '24px', textAlign: 'center' as const, color: '#666' },
	error: { color: '#e11d48', marginBottom: '12px', fontSize: '14px' },
	list: { listStyle: 'none', padding: '0', margin: '0' },
	row: { borderBottom: '1px solid #eee' },
	rowButton: {
		width: '100%',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '10px 0',
		background: 'none',
		border: 'none',
		cursor: 'pointer',
		textAlign: 'left' as const,
	},
	type: { fontSize: '14px', fontWeight: 600 },
	meta: { fontSize: '13px', color: '#666' },
	payload: {
		background: '#f7f7f7',
		borderRadius: '8px',
		padding: '12px',
		fontSize: '12px',
		fontFamily: 'monospace',
		overflowX: 'auto' as const,
		marginBottom: '12px',
	},
	loadMoreButton: {
		marginTop: '16px',
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: '8px',
		padding: '10px 20px',
		fontSize: '14px',
		cursor: 'pointer',
	},
};

export const AuditLogScreen = defineComponent({
	name: 'FonderieAuditLogScreen',
	props: {
		client: { type: Object as PropType<AuditClient>, required: false },
	},
	setup(props) {
		const type = ref('');
		const actorId = ref('');
		const expanded = ref<string | null>(null);

		const filters: IListAuditEventsInput = {};
		const { events, isLoading, isLoadingMore, error, hasMore, refresh, loadMore } = useAuditEvents(
			props.client,
			filters,
		);

		function handleFilterSubmit(event: Event) {
			event.preventDefault();
			if (type.value) filters.type = type.value;
			else delete filters.type;
			if (actorId.value) filters.actorId = actorId.value;
			else delete filters.actorId;
			void refresh();
		}

		function renderEvent(event: IAuditEventDTO) {
			return h('li', { key: event.id, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => {
							expanded.value = expanded.value === event.id ? null : event.id;
						},
					},
					[
						h('span', { style: styles.type }, event.type),
						h(
							'span',
							{ style: styles.meta },
							`${event.actorId ?? 'system'} · ${new Date(event.createdAt).toLocaleString()}`,
						),
					],
				),
				expanded.value === event.id
					? h('pre', { style: styles.payload }, JSON.stringify(event.payload, null, 2))
					: null,
			]);
		}

		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Audit log'),
				h('form', { style: styles.form, onSubmit: handleFilterSubmit }, [
					h('input', {
						style: styles.input,
						placeholder: 'Event type',
						value: type.value,
						onInput: (e: Event) => {
							type.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: 'Actor ID',
						value: actorId.value,
						onInput: (e: Event) => {
							actorId.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'submit', style: styles.filterButton }, 'Filter'),
				]),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				isLoading.value
					? h('p', { style: styles.status }, 'Loading…')
					: h('ul', { style: styles.list }, events.value.map(renderEvent)),
				hasMore.value
					? h(
							'button',
							{
								type: 'button',
								disabled: isLoadingMore.value,
								style: styles.loadMoreButton,
								onClick: loadMore,
							},
							isLoadingMore.value ? 'Loading…' : 'Load more',
						)
					: null,
			]);
	},
});
