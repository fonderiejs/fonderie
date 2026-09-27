import { type AdminClient, type AdminLocale, createAdminT } from '@fonderie/client';
import { useManifest } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { pill } from '../ui';
import { page, table, td } from './common';

// What is deployed: every module, its version, readiness, and whether it
// offers anything to this surface.
export const ModulesScreen = defineComponent({
	name: 'FonderieModulesScreen',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { manifest, isLoading, error } = useManifest(props.client);
		return () => {
			const t = createAdminT(props.locale);
			const m = manifest.value;
			return page(
				t('modules.title'),
				{ isLoading, error },
				() => {
					if (!m) return null;
					return table(
						[
							t('modules.colModule'),
							t('modules.colVersion'),
							t('modules.colReadiness'),
							t('modules.colAdmin'),
						],
						m.modules.map((mod) =>
							h('tr', { key: mod.name }, [
								td(mod.name, { ...styles.mono, fontWeight: 600 }),
								td(
									mod.version ?? h('span', { style: styles.muted }, t('modules.notReported')),
									styles.mono,
								),
								td([
									pill(
										mod.readiness.ok ? 'ok' : 'bad',
										mod.readiness.ok ? t('common.status.ready') : t('common.status.error'),
									),
									...mod.readiness.problems.map((p) =>
										h(
											'div',
											{
												key: p.message,
												style: {
													marginTop: '6px',
													fontSize: '13px',
													color:
														p.severity === 'error'
															? 'var(--fonderie-danger,#e00)'
															: 'var(--fonderie-text-muted,#5c5c5c)',
												},
											},
											p.message,
										),
									),
								]),
								td(
									mod.describesAdmin
										? h('span', { style: styles.badge }, t('modules.describesAdmin'))
										: h('span', { style: styles.muted }, '—'),
								),
							]),
						),
					);
				},
				[],
				{
					loadingText: t('common.loading'),
					lead: m
						? t('modules.leadSummary', {
								env: m.env,
								version: m.admin.version,
								log: m.admin.log ? t('modules.logOn') : t('modules.logOff'),
								routes: m.routes.length,
							})
						: t('modules.lead'),
				},
			);
		};
	},
});
