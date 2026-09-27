import type { AdminClient } from '@fonderie/client';
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
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { manifest, isLoading, error } = useManifest(props.client);
		return () => {
			const m = manifest.value;
			return page(
				'Modules',
				{ isLoading, error },
				() => {
					if (!m) return null;
					return table(
						['Module', 'Version', 'Readiness', 'Admin'],
						m.modules.map((mod) =>
							h('tr', { key: mod.name }, [
								td(mod.name, { ...styles.mono, fontWeight: 600 }),
								td(mod.version ?? h('span', { style: styles.muted }, 'not reported'), styles.mono),
								td([
									pill(mod.readiness.ok ? 'ok' : 'bad', mod.readiness.ok ? 'ready' : 'error'),
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
										? h('span', { style: styles.badge }, 'describes admin')
										: h('span', { style: styles.muted }, '—'),
								),
							]),
						),
					);
				},
				[],
				{
					lead: m
						? `${m.env} · admin ${m.admin.version} · admin log ${m.admin.log ? 'on' : 'off'} · ${m.routes.length} routes`
						: 'Every installed module, its version and whether it is ready.',
				},
			);
		};
	},
});
