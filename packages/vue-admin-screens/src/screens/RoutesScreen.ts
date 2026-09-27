import { type AdminClient, type AdminLocale, createAdminT } from '@fonderie/client';
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
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { report, isLoading, error } = useAdminRoutes(props.client);
		const q = ref('');
		return () => {
			const t = createAdminT(props.locale);
			const needle = q.value.trim().toLowerCase();
			const routes = (report.value?.routes ?? []).filter(
				(r) =>
					!needle ||
					`${r.method} ${r.path} ${r.module ?? 'application'} ${r.guard}`
						.toLowerCase()
						.includes(needle),
			);
			return page(
				t('routes.title'),
				{ isLoading, error },
				() =>
					table(
						[
							{ label: t('routes.colMethod'), style: { width: '80px' } },
							t('routes.colPath'),
							t('routes.colGuard'),
							t('routes.colModule'),
						],
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
									td(r.module ?? t('routes.application'), styles.muted),
								]),
							),
							...(routes.length === 0
								? [
										h('tr', [
											h(
												'td',
												{ style: { ...styles.td, ...styles.muted }, colspan: 4 },
												t('routes.noMatch', { q: q.value }),
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
						placeholder: t('routes.filterPlaceholder'),
						style: { ...styles.input, width: '280px' },
						'aria-label': t('routes.filterLabel'),
						onInput: (e: Event) => {
							q.value = (e.target as HTMLInputElement).value;
						},
					}),
				],
				{
					loadingText: t('common.loading'),
					lead: report.value
						? t('routes.leadCount', { n: report.value.routes.length })
						: t('routes.lead'),
				},
			);
		};
	},
});
