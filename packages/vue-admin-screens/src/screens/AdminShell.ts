import type { AdminClient, ConfigAdminClient, CourierAdminClient } from '@fonderie/client';
import { ConfigEditorScreen, ConfigListScreen } from '@fonderie/vue-config-admin-screens';
import { TemplateEditorScreen, TemplateListScreen } from '@fonderie/vue-courier-admin-screens';
import type { PropType, VNode } from 'vue';
import { computed, defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { AdminLogScreen } from './AdminLogScreen';
import { AttentionScreen } from './AttentionScreen';
import { ConfigScreen } from './ConfigScreen';
import { DoctorScreen } from './DoctorScreen';
import { ModulesScreen } from './ModulesScreen';
import { RoutesScreen } from './RoutesScreen';
import { TokensScreen } from './TokensScreen';

export type AdminPage =
	| 'attention'
	| 'modules'
	| 'doctor'
	| 'config'
	| 'routes'
	| 'tokens'
	| 'log'
	| 'settings'
	| 'templates';

const NAV: Array<{
	group: string;
	items: Array<{ page: AdminPage; label: string; needs?: 'config' | 'courier' }>;
}> = [
	{ group: 'Today', items: [{ page: 'attention', label: 'Attention' }] },
	{
		group: 'System',
		items: [
			{ page: 'modules', label: 'Modules' },
			{ page: 'config', label: 'Configuration' },
			{ page: 'doctor', label: 'Doctor' },
			{ page: 'routes', label: 'Routes' },
		],
	},
	{ group: 'Settings', items: [{ page: 'settings', label: 'Config & secrets', needs: 'config' }] },
	{ group: 'Messaging', items: [{ page: 'templates', label: 'Templates', needs: 'courier' }] },
	{
		group: 'Activity',
		items: [
			{ page: 'log', label: 'Admin log' },
			{ page: 'tokens', label: 'Access' },
		],
	},
];

type Editing =
	| { kind: 'config' | 'secret'; key: string }
	| { kind: 'template'; type: string }
	| null;

export const AdminShell = defineComponent({
	name: 'FonderieAdminShell',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		// Given ⇒ the Settings and Messaging pages appear. Construct them with
		// `prefix: '/_admin'` to go through the one token.
		configClient: { type: Object as PropType<ConfigAdminClient>, default: undefined },
		courierClient: { type: Object as PropType<CourierAdminClient>, default: undefined },
		environment: { type: String, default: undefined },
		// Controlled navigation: pass `page` and listen to `navigate` to own the
		// URL. Omit `page` and the shell keeps it itself.
		page: { type: String as PropType<AdminPage>, default: undefined },
	},
	emits: { navigate: (_page: AdminPage) => true },
	setup(props, { emit }) {
		const own = ref<AdminPage>('attention');
		const current = computed(() => props.page ?? own.value);
		const editing = ref<Editing>(null);
		const go = (p: AdminPage) => {
			editing.value = null;
			emit('navigate', p);
			if (props.page === undefined) own.value = p;
		};
		const back = () =>
			h(
				'button',
				{ type: 'button', style: styles.button, onClick: () => (editing.value = null) },
				'← Back',
			);

		const body = (): VNode | VNode[] => {
			const c = props.client;
			switch (current.value) {
				case 'attention':
					return h(AttentionScreen, { client: c });
				case 'modules':
					return h(ModulesScreen, { client: c });
				case 'doctor':
					return h(DoctorScreen, { client: c });
				case 'config':
					return h(ConfigScreen, { client: c });
				case 'routes':
					return h(RoutesScreen, { client: c });
				case 'tokens':
					return h(TokensScreen, { client: c });
				case 'log':
					return h(AdminLogScreen, { client: c });
				case 'settings': {
					const cc = props.configClient;
					if (!cc)
						return h(
							'p',
							{ style: styles.status },
							'Pass a ConfigAdminClient to manage config and secrets here.',
						);
					const e = editing.value;
					if (e && e.kind !== 'template')
						return [
							back(),
							h(ConfigEditorScreen, {
								client: cc,
								kind: e.kind,
								configKey: e.key,
								...(props.environment !== undefined ? { environment: props.environment } : {}),
								onSaved: () => (editing.value = null),
							}),
						];
					return h(ConfigListScreen, {
						client: cc,
						...(props.environment !== undefined ? { environment: props.environment } : {}),
						'onSelect-config': (key: string) => (editing.value = { kind: 'config', key }),
						'onSelect-secret': (key: string) => (editing.value = { kind: 'secret', key }),
					});
				}
				case 'templates': {
					const kc = props.courierClient;
					if (!kc)
						return h(
							'p',
							{ style: styles.status },
							'Pass a CourierAdminClient to manage templates here.',
						);
					const e = editing.value;
					if (e?.kind === 'template')
						return [
							back(),
							h(TemplateEditorScreen, {
								client: kc,
								type: e.type,
								onSaved: () => (editing.value = null),
							}),
						];
					return h(TemplateListScreen, {
						client: kc,
						'onSelect-template': (t: { type: string }) =>
							(editing.value = { kind: 'template', type: t.type }),
					});
				}
			}
		};

		return () =>
			h('div', { style: styles.shell }, [
				h(
					'nav',
					{ style: styles.nav, 'aria-label': 'Admin' },
					NAV.map((g) => {
						const items = g.items.filter(
							(i) => !i.needs || (i.needs === 'config' ? props.configClient : props.courierClient),
						);
						if (items.length === 0) return null;
						return h('div', { key: g.group }, [
							h('div', { style: styles.navGroup }, g.group),
							...items.map((i) =>
								h(
									'button',
									{
										key: i.page,
										type: 'button',
										style: {
											...styles.navItem,
											...(current.value === i.page ? styles.navItemActive : {}),
										},
										'aria-current': current.value === i.page ? 'page' : undefined,
										onClick: () => go(i.page),
									},
									i.label,
								),
							),
						]);
					}),
				),
				h('main', { style: styles.main }, body()),
			]);
	},
});
