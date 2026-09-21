import type { AdminClient } from '@fonderie/client';
import { useAttention } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { page, refreshButton } from './common';

export const AttentionScreen = defineComponent({
	name: 'FonderieAttentionScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { attention, isLoading, error, refresh } = useAttention(props.client);
		return () =>
			page(
				'Attention',
				{ isLoading, error },
				() => {
					const a = attention.value;
					if (!a) return null;
					if (a.items.length === 0)
						return h(
							'p',
							{ style: styles.ok },
							`Nothing needs you. Checked ${new Date(a.generatedAt).toLocaleString()}.`,
						);
					return h(
						'ul',
						{ style: styles.list },
						a.items.map((item) =>
							h('li', { key: `${item.source}:${item.message}`, style: styles.row }, [
								h(
									'span',
									{ style: item.severity === 'error' ? styles.bad : styles.advice },
									item.severity,
								),
								' ',
								h('span', { style: styles.mono }, item.source),
								` — ${item.message}`,
							]),
						),
					);
				},
				[refreshButton('Refresh', isLoading.value, () => void refresh())],
				{ loadingText: 'Running the checks…' },
			);
	},
});
