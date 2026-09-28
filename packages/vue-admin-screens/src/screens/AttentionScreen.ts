import {
	type AdminClient,
	type AdminLocale,
	createAdminT,
	formatAdminDate,
	localizeReason,
} from '@fonderie/client';
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
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { attention, isLoading, error, refresh } = useAttention(props.client);
		const { manifest } = useManifest(props.client);
		return () => {
			const t = createAdminT(props.locale);
			const a = attention.value;
			const m = manifest.value;
			const errors = a?.items.filter((i) => i.severity === 'error') ?? [];
			const advice = a?.items.filter((i) => i.severity !== 'error') ?? [];
			const ready = m?.modules.filter((x) => x.readiness.ok).length ?? 0;
			const total = m?.modules.length ?? 0;
			const tiles = h('div', { style: styles.grid }, [
				stat(
					t('attention.needsAction'),
					a ? errors.length : '—',
					t('attention.needsActionHint'),
					errors.length ? 'bad' : a ? 'ok' : undefined,
				),
				stat(
					t('attention.advice'),
					a ? advice.length : '—',
					t('attention.adviceHint'),
					advice.length ? 'warn' : undefined,
				),
				stat(
					t('attention.modulesReady'),
					m ? `${ready}/${total}` : '—',
					m ? t('attention.modulesReadyHint', { version: m.admin.version }) : undefined,
					m && ready < total ? 'warn' : m ? 'ok' : undefined,
				),
				stat(t('attention.routes'), m ? m.routes.length : '—', m ? m.env : undefined),
			]);
			return page(
				t('attention.title'),
				// Tiles show while the checks run; only the list waits.
				{ isLoading: { value: false }, error },
				() => {
					if (isLoading.value && !a)
						return [tiles, h('p', { style: styles.status }, t('attention.running'))];
					if (!a) return tiles;
					if (a.items.length === 0)
						return [
							tiles,
							empty(
								t('attention.emptyTitle'),
								t('attention.emptyBody', { time: formatAdminDate(a.generatedAt, props.locale) }),
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
														item.severity === 'error'
															? t('common.status.error')
															: t('common.status.advice'),
													),
													h('span', { style: styles.mono }, item.source),
												],
											),
											h('div', { style: { lineHeight: 1.55 } }, localizeReason(item, props.locale)),
										]),
									],
								),
							),
						),
					];
				},
				[
					refreshButton(
						t('common.refresh'),
						isLoading.value,
						() => void refresh(),
						t('common.working'),
					),
				],
				{
					lead: a
						? t('attention.leadChecked', {
								time: formatAdminDate(a.generatedAt, props.locale, 'time'),
							})
						: t('attention.lead'),
				},
			);
		};
	},
});
