import type { AdminClient } from '@fonderie/client';
import { useAdminRoutes } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { methodChip, pill } from '../ui';
import { page, table, td } from './common';

// Every exposed route and what guards it. A hundred rows is normal, so the
// page filters as you type.
export const RoutesScreen = defineComponent({
	name: 'FonderieRoutesScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error } = useAdminRoutes(props.client);
		const q = ref('');
		return () => {
			const needle = q.value.trim().toLowerCase();
			const routes = (report.value?.routes ?? []).filter(
				(r) =>
					!needle ||
					`${r.method} ${r.path} ${r.module ?? 'application'} ${r.guard}`
						.toLowerCase()
						.includes(needle),
			);
			return page(
				'Routes',
				{ isLoading, error },
				() =>
					table(
						[{ label: 'Method', style: { width: '80px' } }, 'Path', 'Guard', 'Module'],
						[
							...routes.map((r) =>
								h('tr', { key: `${r.method} ${r.path}` }, [
									td(methodChip(r.method)),
									td(r.path, { ...styles.mono, wordBreak: 'break-all' }),
									td(
										pill(
											r.guard === 'admin' ? 'ok' : r.guard === 'probe' ? 'neutral' : 'info',
											r.guard,
											false,
										),
									),
									td(r.module ?? 'application', styles.muted),
								]),
							),
							...(routes.length === 0
								? [
										h('tr', [
											h(
												'td',
												{ style: { ...styles.td, ...styles.muted }, colspan: 4 },
												`No route matches “${q.value}”.`,
											),
										]),
									]
								: []),
						],
					),
				[
					h('input', {
						type: 'search',
						value: q.value,
						placeholder: 'Filter by path, method, module…',
						style: { ...styles.input, width: '280px' },
						'aria-label': 'Filter routes',
						onInput: (e: Event) => {
							q.value = (e.target as HTMLInputElement).value;
						},
					}),
				],
				{
					lead: report.value
						? `${report.value.routes.length} routes exposed by this deployment, with the guard in front of each.`
						: 'Every exposed route, with its guard.',
				},
			);
		};
	},
});
