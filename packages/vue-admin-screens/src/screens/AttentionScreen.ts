import type { AdminClient } from '@fonderie/client';
import { useAttention, useManifest } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { empty, icon, pill, stat } from '../ui';
import { page, refreshButton } from './common';

// What needs the operator today. Empty is green. The tiles above the list are
// the at-a-glance answer; the list is what to do about it.
export const AttentionScreen = defineComponent({
	name: 'FonderieAttentionScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { attention, isLoading, error, refresh } = useAttention(props.client);
		const { manifest } = useManifest(props.client);
		return () => {
			const a = attention.value;
			const m = manifest.value;
			const errors = a?.items.filter((i) => i.severity === 'error') ?? [];
			const advice = a?.items.filter((i) => i.severity !== 'error') ?? [];
			const ready = m?.modules.filter((x) => x.readiness.ok).length ?? 0;
			const total = m?.modules.length ?? 0;
			const tiles = h('div', { style: styles.grid }, [
				stat(
					'Needs action',
					a ? errors.length : '—',
					'errors to fix',
					errors.length ? 'bad' : a ? 'ok' : undefined,
				),
				stat('Advice', a ? advice.length : '—', 'worth a look', advice.length ? 'warn' : undefined),
				stat(
					'Modules ready',
					m ? `${ready}/${total}` : '—',
					m ? `admin ${m.admin.version}` : undefined,
					m && ready < total ? 'warn' : m ? 'ok' : undefined,
				),
				stat('Routes', m ? m.routes.length : '—', m ? m.env : undefined),
			]);
			return page(
				'Attention',
				// Tiles show while the checks run; only the list waits.
				{ isLoading: { value: false }, error },
				() => {
					if (isLoading.value && !a)
						return [tiles, h('p', { style: styles.status }, 'Running the checks…')];
					if (!a) return tiles;
					if (a.items.length === 0)
						return [
							tiles,
							empty(
								'Nothing needs you',
								`Every check passes. Checked ${new Date(a.generatedAt).toLocaleString()}.`,
							),
						];
					return [
						tiles,
						h(
							'ul',
							{ style: styles.list },
							[...errors, ...advice].map((item) =>
								h(
									'li',
									{
										key: `${item.source}:${item.message}`,
										style: {
											...styles.row,
											display: 'flex',
											gap: '12px',
											alignItems: 'flex-start',
										},
									},
									[
										icon('alert', 16, {
											marginTop: '3px',
											color:
												item.severity === 'error'
													? 'var(--fonderie-danger,#e00)'
													: 'var(--fonderie-warning,#f5a623)',
										}),
										h('div', { style: { minWidth: 0, flex: 1 } }, [
											h(
												'div',
												{
													style: {
														display: 'flex',
														gap: '8px',
														alignItems: 'center',
														flexWrap: 'wrap',
														marginBottom: '2px',
													},
												},
												[
													pill(
														item.severity === 'error' ? 'bad' : 'warn',
														item.severity === 'error' ? 'error' : 'advice',
													),
													h('span', { style: styles.mono }, item.source),
												],
											),
											h('div', { style: { lineHeight: 1.55 } }, item.message),
										]),
									],
								),
							),
						),
					];
				},
				[refreshButton('Refresh', isLoading.value, () => void refresh())],
				{
					lead: a
						? `What needs you on this deployment · checked ${new Date(a.generatedAt).toLocaleTimeString()}`
						: 'What needs you on this deployment',
				},
			);
		};
	},
});
