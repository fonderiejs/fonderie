import type { AdminClient } from '@fonderie/client';
import { useAdminRoutes } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { page, table, td } from './common';

export const RoutesScreen = defineComponent({
	name: 'FonderieRoutesScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error } = useAdminRoutes(props.client);
		return () =>
			page('Routes', { isLoading, error }, () =>
				table(
					['Method', 'Path', 'Guard', 'Module'],
					(report.value?.routes ?? []).map((r) =>
						h('tr', { key: `${r.method} ${r.path}` }, [
							td(r.method, styles.mono),
							td(r.path, styles.mono),
							td(h('span', { style: styles.badge }, r.guard)),
							td(r.module ?? 'application', styles.muted),
						]),
					),
				),
			);
	},
});
