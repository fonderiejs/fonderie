import type { BillingAdminClient } from '@fonderie/client';
import { useAdminCatalog } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
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
				h('div', { style: styles.toolbar }, [
					h('h1', { style: { ...styles.title, marginBottom: 0 } }, 'Catalog'),
					refreshButton('Refresh', isLoading.value, () => void refresh()),
				]),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				isLoading.value && !c ? h('p', { style: styles.status }, 'Loading…') : null,
				c
					? [
							h('h2', { style: styles.subtitle }, 'Configured (code)'),
							h(
								'pre',
								{
									style: {
										...styles.mono,
										background: '#f9fafb',
										padding: '12px',
										overflowX: 'auto',
									},
								},
								JSON.stringify(c.configured, null, 2),
							),
							h('h2', { style: styles.subtitle }, 'Stored (database)'),
							c.stored.length === 0
								? h('p', { style: styles.muted }, 'No stored plans.')
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
															style: styles.button,
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
