import type { AdminClient } from '@fonderie/client';
import { useManifest } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { page, table, td } from './common';

export const ModulesScreen = defineComponent({
	name: 'FonderieModulesScreen',
	props: { client: { type: Object as PropType<AdminClient>, required: true } },
	setup(props) {
		const { manifest, isLoading, error } = useManifest(props.client);
		return () =>
			page('Modules', { isLoading, error }, () => {
				const m = manifest.value;
				if (!m) return null;
				return [
					h(
						'p',
						{ style: styles.muted },
						`${m.env} · admin ${m.admin.version} · admin log ${m.admin.log ? 'on' : 'off'} · ${m.routes.length} routes`,
					),
					table(
						['Module', 'Version', 'Readiness', 'Describes admin'],
						m.modules.map((mod) =>
							h('tr', { key: mod.name }, [
								td(mod.name, styles.mono),
								td(mod.version ?? h('span', { style: styles.muted }, 'not reported')),
								td([
									h(
										'span',
										{ style: mod.readiness.ok ? styles.ok : styles.bad },
										mod.readiness.ok ? 'ok' : 'error',
									),
									...mod.readiness.problems.map((p) =>
										h(
											'div',
											{
												key: p.message,
												style: p.severity === 'error' ? styles.bad : styles.advice,
											},
											p.message,
										),
									),
								]),
								td(mod.describesAdmin ? 'yes' : h('span', { style: styles.muted }, 'no')),
							]),
						),
					),
				];
			});
	},
});
