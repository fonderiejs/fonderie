import type { BillingAdminClient } from '@fonderie/client';
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
	props: { client: { type: Object as PropType<BillingAdminClient>, required: true } },
	setup(props) {
		const { catalog, isLoading, error, refresh, deletePlan } = useAdminCatalog(props.client);
		const money = (v: number | null | undefined) => (v == null ? '—' : (v / 100).toFixed(2));
		return () => {
			const c = catalog.value;
			return h('div', { style: styles.container }, [
				pageHeader(
					'Catalog',
					'What you sell: plans as configured in code, and as stored in the database, side by side.',
					[refreshButton('Refresh', isLoading.value, () => void refresh())],
				),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				isLoading.value && !c ? h('p', { style: styles.status }, 'Loading…') : null,
				c
					? [
							h('h2', { style: { ...styles.subtitle, marginTop: 0 } }, 'Configured (code)'),
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
							h('h2', { style: styles.subtitle }, 'Stored (database)'),
							c.stored.length === 0
								? empty(
										'No stored plans',
										'Plans are configured in code; nothing has been written to the database.',
										'catalog',
									)
								: table(
										['Plan', 'Tier', 'Seats', 'Monthly', 'Yearly', 'Trial', ''],
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
												td(p.trialDays ? `${p.trialDays} d` : '—'),
												td(
													h(
														'button',
														{
															type: 'button',
															style: styles.buttonDanger,
															onClick: () => {
																if (window.confirm(`Delete stored plan "${p.name}"?`))
																	void deletePlan(p.id).catch(() => {});
															},
														},
														'Delete',
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
