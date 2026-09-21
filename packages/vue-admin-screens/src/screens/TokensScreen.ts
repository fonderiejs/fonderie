import type { AdminClient } from '@fonderie/client';
import { useAdminTokens } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { page } from './common';

export const TokensScreen = defineComponent({
	name: 'FonderieTokensScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { report, isLoading, error } = useAdminTokens(props.client);
		return () =>
			page('Access', { isLoading, error }, () => {
				const r = report.value;
				if (!r) return null;
				return [
					h('h2', { style: styles.subtitle }, 'Admin token'),
					h('p', [
						h(
							'span',
							{ style: r.admin.ok ? styles.ok : styles.bad },
							r.admin.ok ? 'strong' : 'weak',
						),
						...r.admin.problems.map((p) =>
							h('div', { key: p.message, style: styles.bad }, p.message),
						),
					]),
					h('h2', { style: styles.subtitle }, 'Legacy per-brick tokens'),
					r.legacy.length === 0
						? h(
								'p',
								{ style: styles.muted },
								"None — every brick's admin surface goes through this token.",
							)
						: h(
								'ul',
								{ style: styles.list },
								r.legacy.map((l) =>
									h('li', { key: l.module, style: styles.row }, [
										h('span', { style: styles.mono }, l.module),
										' ',
										h(
											'span',
											{ style: styles.muted },
											'still registers its standalone routes with its own token (deprecated)',
										),
									]),
								),
							),
				];
			});
	},
});
