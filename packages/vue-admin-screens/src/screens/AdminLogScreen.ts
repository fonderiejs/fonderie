import type { AdminClient } from '@fonderie/client';
import { useAdminLog } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { empty, methodChip, pageHeader, pill } from '../ui';
import { loadMoreButton, refreshButton, table, td } from './common';

// Who did what through the surface, newest first — refused requests included.
export const AdminLogScreen = defineComponent({
	name: 'FonderieAdminLogScreen',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
	},
	setup(props) {
		const { entries, hasMore, isLoading, error, refresh, loadMore } = useAdminLog(props.client, {
			limit: props.pageSize,
		});
		return () =>
			h('div', { style: styles.container }, [
				pageHeader(
					'Admin log',
					'Every request made through this surface, newest first — refused ones included.',
					[refreshButton('Refresh', isLoading.value, () => void refresh())],
				),
				error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 404
								? 'The admin log is off — give AdminModule a store.'
								: error.value.explanation,
						)
					: entries.value.length === 0 && !isLoading.value
						? empty('No requests yet', undefined, 'log')
						: [
								table(
									['When', 'Actor', 'Request', 'Status', 'Module'],
									entries.value.map((e) =>
										h('tr', { key: e.id }, [
											td(new Date(e.at).toLocaleString(), {
												...styles.muted,
												whiteSpace: 'nowrap',
											}),
											td(e.actor),
											td([
												methodChip(e.method),
												' ',
												h('span', { style: { ...styles.mono, wordBreak: 'break-all' } }, e.path),
											]),
											td(
												[
													pill(
														e.status >= 500 ? 'bad' : e.status >= 400 ? 'warn' : 'ok',
														String(e.status),
													),
													' ',
													h('span', { style: styles.muted }, `${e.durationMs} ms`),
												],
												{ whiteSpace: 'nowrap' },
											),
											td(e.module, styles.muted),
										]),
									),
								),
								isLoading.value ? h('p', { style: styles.status }, 'Loading…') : null,
								hasMore.value && !isLoading.value ? loadMoreButton(() => void loadMore()) : null,
							],
			]);
	},
});
