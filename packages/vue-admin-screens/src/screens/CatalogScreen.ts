import { type AdminLocale, type BillingAdminClient, createAdminT } from '@fonderie/client';
import { useAdminCatalog } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { empty, pageHeader } from '../ui';
import { refreshButton, table, td } from './common';

// What am I selling: the plans as configured in code, and as stored in the
// database — side by side, so a divergence is visible. Report, do not repair.
export const CatalogScreen = defineComponent({
	name: 'FonderieCatalogScreen',
	props: {
		client: { type: Object as PropType<BillingAdminClient>, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { catalog, isLoading, error, refresh, deletePlan } = useAdminCatalog(props.client);
		const money = (v: number | null | undefined) => (v == null ? '—' : (v / 100).toFixed(2));
		return () => {
			const t = createAdminT(props.locale);
			const c = catalog.value;
			return h('div', { style: styles.container }, [
				pageHeader(t('catalog.title'), t('catalog.lead'), [
					refreshButton(
						t('common.refresh'),
						isLoading.value,
						() => void refresh(),
						t('common.working'),
					),
				]),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				isLoading.value && !c ? h('p', { style: styles.status }, t('common.loading')) : null,
				c
					? [
							h('h2', { style: { ...styles.subtitle, marginTop: 0 } }, t('catalog.configured')),
							h(
								'pre',
								{
									style: {
										...styles.card,
										...styles.mono,
										margin: 0,
										overflowX: 'auto',
										maxHeight: '360px',
										lineHeight: 1.6,
									},
								},
								JSON.stringify(c.configured, null, 2),
							),
							h('h2', { style: styles.subtitle }, t('catalog.stored')),
							c.stored.length === 0
								? empty(t('catalog.emptyTitle'), t('catalog.emptyBody'), 'catalog')
								: table(
										[
											t('catalog.col.plan'),
											t('catalog.col.tier'),
											t('catalog.col.seats'),
											t('catalog.col.monthly'),
											t('catalog.col.yearly'),
											t('catalog.col.trial'),
											'',
										],
										c.stored.map((p) =>
											h('tr', { key: p.id }, [
												td([
													h('strong', p.name),
													p.description ? h('div', { style: styles.muted }, p.description) : '',
												]),
												td(String(p.tier)),
												td(p.seats == null ? '∞' : String(p.seats)),
												td(`${money(p.pricing?.monthly)} ${p.pricing?.currency ?? ''}`),
												td(money(p.pricing?.yearly)),
												td(p.trialDays ? t('catalog.trialDays', { n: p.trialDays }) : '—'),
												td(
													h(
														'button',
														{
															type: 'button',
															style: styles.buttonDanger,
															onClick: () => {
																if (window.confirm(t('catalog.deleteConfirm', { name: p.name })))
																	void deletePlan(p.id).catch(() => {});
															},
														},
														t('common.delete'),
													),
												),
											]),
										),
									),
						]
					: null,
			]);
		};
	},
});
