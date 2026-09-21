import type { AdminClient } from '@fonderie/client';
import { useAdminLog } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { refreshButton, table, td } from './common';

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
				h('div', { style: styles.toolbar }, [
					h('h1', { style: { ...styles.title, marginBottom: 0 } }, 'Admin log'),
					refreshButton('Refresh', isLoading.value, () => void refresh()),
				]),
				error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 404
								? 'The admin log is off — give AdminModule a store.'
								: error.value.explanation,
						)
					: [
							table(
								['When', 'Actor', 'Request', 'Status', 'Module'],
								entries.value.map((e) =>
									h('tr', { key: e.id }, [
										td(new Date(e.at).toLocaleString(), styles.muted),
										td(e.actor),
										td(`${e.method} ${e.path}`, styles.mono),
										td([
											h(
												'span',
												{ style: e.status >= 400 ? styles.bad : styles.ok },
												String(e.status),
											),
											' ',
											h('span', { style: styles.muted }, `${e.durationMs} ms`),
										]),
										td(e.module, styles.muted),
									]),
								),
							),
							isLoading.value ? h('p', { style: styles.status }, 'Loading…') : null,
							hasMore.value && !isLoading.value
								? h(
										'button',
										{
											type: 'button',
											style: { ...styles.button, marginTop: '12px' },
											onClick: () => void loadMore(),
										},
										'Load more',
									)
								: null,
						],
			]);
	},
});
