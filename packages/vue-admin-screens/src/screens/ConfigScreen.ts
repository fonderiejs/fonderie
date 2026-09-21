import type { AdminClient } from '@fonderie/client';
import { useAdminConfig } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { page } from './common';

export const ConfigScreen = defineComponent({
	name: 'FonderieConfigScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error } = useAdminConfig(props.client);
		return () =>
			page('Configuration', { isLoading, error }, () => {
				const r = report.value;
				if (!r) return null;
				return [
					h('h2', { style: styles.subtitle }, 'Readiness'),
					h(
						'ul',
						{ style: styles.list },
						r.modules.map((m) =>
							h('li', { key: m.name, style: styles.row }, [
								h('span', { style: styles.mono }, m.name),
								' ',
								...(m.problems.length === 0
									? [h('span', { style: styles.ok }, 'ok')]
									: m.problems.map((p) =>
											h(
												'div',
												{
													key: p.message,
													style: p.severity === 'error' ? styles.bad : styles.advice,
												},
												p.message,
											),
										)),
							]),
						),
					),
					h('h2', { style: styles.subtitle }, 'Environment'),
					r.env.length === 0
						? h('p', { style: styles.muted }, 'No variables declared — pass `env` to AdminModule.')
						: h(
								'ul',
								{ style: styles.list },
								r.env.map((e) =>
									h('li', { key: e.name, style: styles.row }, [
										h('span', { style: styles.mono }, e.name),
										' ',
										h('span', { style: e.set ? styles.ok : styles.bad }, e.set ? 'set' : 'missing'),
									]),
								),
							),
				];
			});
	},
});
