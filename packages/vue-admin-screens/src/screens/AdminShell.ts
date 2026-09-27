import type {
	AdminClient,
	AuditAdminClient,
	AuthAdminClient,
	BillingAdminClient,
	ConfigAdminClient,
	CourierAdminClient,
} from '@fonderie/client';
import { ConfigEditorScreen, ConfigListScreen } from '@fonderie/vue-config-admin-screens';
import { TemplateEditorScreen, TemplateListScreen } from '@fonderie/vue-courier-admin-screens';
import type { PropType, VNode } from 'vue';
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import type { IconName } from '../icons';
import { styles } from '../styles';
import { icon } from '../ui';
import { AdminLogScreen } from './AdminLogScreen';
import { AttentionScreen } from './AttentionScreen';
import { EnvironmentScreen } from './EnvironmentScreen';
import { DoctorScreen } from './DoctorScreen';
import { ModulesScreen } from './ModulesScreen';
import { RoutesScreen } from './RoutesScreen';
import { MigrationsScreen } from './MigrationsScreen';
import { OperatorsScreen } from './OperatorsScreen';
import { TokensScreen } from './TokensScreen';
import { UsersScreen } from './UsersScreen';
import { CatalogScreen } from './CatalogScreen';
import { SubscriberScreen } from './SubscriberScreen';
import { AuditScreen } from './AuditScreen';

export type AdminPage =
	| 'attention'
	| 'modules'
	| 'doctor'
	| 'environment'
	| 'routes'
	| 'migrations'
	| 'tokens'
	| 'operators'
	| 'log'
	| 'settings'
	| 'templates'
	| 'users'
	| 'catalog'
	| 'subscriber'
	| 'audit';

const NAV: Array<{
	group: string;
	items: Array<{
		page: AdminPage;
		label: string;
		needs?: 'config' | 'courier' | 'auth' | 'billing' | 'audit' | 'operators';
	}>;
}> = [
	{ group: 'Today', items: [{ page: 'attention', label: 'Attention' }] },
	{
		group: 'System',
		items: [
			{ page: 'modules', label: 'Modules' },
			{ page: 'environment', label: 'Environment' },
			{ page: 'doctor', label: 'Doctor' },
			{ page: 'routes', label: 'Routes' },
		],
	},
	{ group: 'People', items: [{ page: 'users', label: 'Users', needs: 'auth' }] },
	{
		group: 'Money',
		items: [
			{ page: 'catalog', label: 'Catalog', needs: 'billing' },
			{ page: 'subscriber', label: 'Subscriptions', needs: 'billing' },
		],
	},
	{ group: 'Settings', items: [{ page: 'settings', label: 'Config & secrets', needs: 'config' }] },
	{ group: 'Messaging', items: [{ page: 'templates', label: 'Templates', needs: 'courier' }] },
	{
		group: 'Activity',
		items: [
			{ page: 'audit', label: 'Audit', needs: 'audit' },
			{ page: 'log', label: 'Admin log' },
			{ page: 'operators', label: 'Operators', needs: 'operators' },
			{ page: 'tokens', label: 'Tokens' },
			{ page: 'migrations', label: 'Migrations' },
		],
	},
];

const ICON: Record<AdminPage, IconName> = {
	attention: 'attention',
	modules: 'modules',
	environment: 'environment',
	doctor: 'doctor',
	routes: 'routes',
	users: 'users',
	catalog: 'catalog',
	subscriber: 'subscriber',
	settings: 'settings',
	templates: 'templates',
	audit: 'audit',
	log: 'log',
	tokens: 'tokens',
	operators: 'users',
	migrations: 'migrations',
};

// Below this width the sidebar becomes a drawer behind a top bar. Measured in
// JS rather than a media query so it also works embedded, with no stylesheet.
const NARROW = '(max-width: 820px)';

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
		// Given ⇒ the People page (users) appears; needs @fonderie/auth ≥ 7.8.
		authClient: { type: Object as PropType<AuthAdminClient>, default: undefined },
		// Given ⇒ the Money pages (catalog, subscriber) appear; needs @fonderie/billing ≥ 9.10.
		billingClient: { type: Object as PropType<BillingAdminClient>, default: undefined },
		// Given ⇒ the Audit page appears; needs @fonderie/audit ≥ 5.2.
		auditClient: { type: Object as PropType<AuditAdminClient>, default: undefined },
		environment: { type: String, default: undefined },
		// Controlled navigation: pass `page` and listen to `navigate` to own the
		// URL. Omit `page` and the shell keeps it itself.
		page: { type: String as PropType<AdminPage>, default: undefined },
		// Shown at the top of the sidebar. Defaults to "Admin".
		appName: { type: String, default: 'Admin' },
		// A badge beside the name — the deployment's environment ("production").
		// Production is tinted so an operator always knows where their clicks land.
		envLabel: { type: String, default: undefined },
		// The deployment has operator accounts (@fonderie/admin with a store):
		// shows the Operators page.
		operators: { type: Boolean, default: false },
		// The signed-in operator's email, when a person (not a token) is signed in.
		currentOperator: { type: String, default: undefined },
	},
	// `footer` slot: pinned to the bottom of the sidebar — session controls
	// (theme, sign out). The React shell takes the same thing as a `footer` prop.
	emits: { navigate: (_page: AdminPage) => true },
	setup(props, { emit, slots }) {
		const query =
			typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW) : null;
		const narrow = ref(query?.matches ?? false);
		const drawer = ref(false);
		const onMedia = (e: MediaQueryListEvent) => (narrow.value = e.matches);
		onMounted(() => query?.addEventListener('change', onMedia));
		onBeforeUnmount(() => query?.removeEventListener('change', onMedia));
		const own = ref<AdminPage>('attention');
		const current = computed(() => props.page ?? own.value);
		const editing = ref<Editing>(null);
		// A user opened from Subscriptions: their billing lives on the Users page.
		const openUser = ref<string | undefined>(undefined);
		const go = (p: AdminPage) => {
			editing.value = null;
			emit('navigate', p);
			if (props.page === undefined) own.value = p;
			drawer.value = false;
		};
		const back = (label: string) =>
			h('div', { style: { padding: '24px 40px 0' } }, [
				h(
					'button',
					{ type: 'button', style: styles.buttonGhost, onClick: () => (editing.value = null) },
					[icon('back', 14), label],
				),
			]);
		const missing = (text: string) =>
			h('p', { style: { ...styles.status, padding: '32px 40px' } }, text);

		const body = (): VNode | VNode[] => {
			const c = props.client;
			switch (current.value) {
				case 'attention':
					return h(AttentionScreen, { client: c });
				case 'modules':
					return h(ModulesScreen, { client: c });
				case 'doctor':
					return h(DoctorScreen, { client: c });
				case 'environment':
					return h(EnvironmentScreen, { client: c });
				case 'routes':
					return h(RoutesScreen, { client: c });
				case 'tokens':
					return h(TokensScreen, { client: c });
				case 'operators':
					return h(OperatorsScreen, {
						client: c,
						...(props.currentOperator ? { me: props.currentOperator } : {}),
					});
				case 'migrations':
					return h(MigrationsScreen, { client: c });
				case 'log':
					return h(AdminLogScreen, { client: c });
				case 'catalog':
					return props.billingClient
						? h(CatalogScreen, { client: props.billingClient })
						: missing('Pass a BillingAdminClient to see the catalog here.');
				case 'subscriber':
					return props.billingClient
						? h(SubscriberScreen, {
								client: props.billingClient,
								...(props.authClient
									? {
											onOpenUser: (id: string) => {
												openUser.value = id;
												go('users');
											},
										}
									: {}),
							})
						: missing('Pass a BillingAdminClient to look up subscribers here.');
				case 'audit':
					return props.auditClient
						? h(AuditScreen, { client: props.auditClient })
						: missing('Pass an AuditAdminClient to see the audit trail here.');
				case 'users':
					return props.authClient
						? h(UsersScreen, {
								key: openUser.value ?? 'list',
								client: props.authClient,
								...(props.billingClient ? { billingClient: props.billingClient } : {}),
								...(openUser.value ? { openUserId: openUser.value } : {}),
							})
						: missing('Pass an AuthAdminClient to look up users here.');
				case 'settings': {
					const cc = props.configClient;
					if (!cc) return missing('Pass a ConfigAdminClient to manage config and secrets here.');
					const e = editing.value;
					if (e && e.kind !== 'template')
						return [
							back('Config & secrets'),
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
						allowCreate: true,
						'onCreate-config': () => (editing.value = { kind: 'config', key: '' }),
						'onCreate-secret': () => (editing.value = { kind: 'secret', key: '' }),
					});
				}
				case 'templates': {
					const kc = props.courierClient;
					if (!kc) return missing('Pass a CourierAdminClient to manage templates here.');
					const e = editing.value;
					if (e?.kind === 'template')
						return [
							back('Templates'),
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

		const visible = (i: {
			needs?: 'config' | 'courier' | 'auth' | 'billing' | 'audit' | 'operators';
		}) =>
			!i.needs ||
			(i.needs === 'operators'
				? props.operators
				: i.needs === 'config'
					? props.configClient
					: i.needs === 'courier'
						? props.courierClient
						: i.needs === 'auth'
							? props.authClient
							: i.needs === 'billing'
								? props.billingClient
								: props.auditClient);

		const brand = () => {
			const production = props.envLabel ? /^prod/i.test(props.envLabel) : false;
			return h('div', { style: styles.navBrand }, [
				h('div', { style: styles.navMark }, [icon('mark', 15)]),
				h('div', { style: { minWidth: 0, flex: 1 } }, [
					h('div', { style: styles.navBrandTitle }, props.appName),
					props.envLabel
						? h(
								'span',
								{
									style: {
										...styles.badge,
										marginTop: '3px',
										padding: '0 7px',
										fontSize: '11px',
										...(production
											? {
													color: 'var(--fonderie-danger,#e00)',
													borderColor:
														'color-mix(in srgb, var(--fonderie-danger,#e00) 35%, transparent)',
												}
											: {}),
									},
								},
								props.envLabel,
							)
						: null,
				]),
				narrow.value
					? h(
							'button',
							{
								type: 'button',
								style: styles.buttonGhost,
								'aria-label': 'Close menu',
								onClick: () => (drawer.value = false),
							},
							[icon('close')],
						)
					: null,
			]);
		};

		const nav = () =>
			h(
				'nav',
				{
					style: {
						...styles.nav,
						...(narrow.value
							? { width: '280px', maxWidth: '85vw', boxShadow: '0 10px 40px rgba(0,0,0,.25)' }
							: {}),
					},
					'aria-label': 'Admin',
				},
				[
					brand(),
					h(
						'div',
						{ style: styles.navScroll },
						NAV.map((g) => {
							const items = g.items.filter(visible);
							if (items.length === 0) return null;
							return h('div', { key: g.group }, [
								h('div', { style: styles.navGroup }, g.group),
								...items.map((i) => {
									const active = current.value === i.page;
									return h(
										'button',
										{
											key: i.page,
											type: 'button',
											class: 'fonderie-admin-nav-item',
											style: { ...styles.navItem, ...(active ? styles.navItemActive : {}) },
											'aria-current': active ? 'page' : undefined,
											onClick: () => {
												openUser.value = undefined;
												go(i.page);
											},
										},
										[icon(ICON[i.page], 16, active ? styles.navIconActive : undefined), i.label],
									);
								}),
							]);
						}),
					),
					slots['footer'] ? h('div', { style: styles.navFooter }, slots['footer']()) : null,
				],
			);

		return () => {
			const title = NAV.flatMap((g) => g.items).find((i) => i.page === current.value)?.label ?? '';
			return h(
				'div',
				{ style: { ...styles.shell, ...(narrow.value ? { flexDirection: 'column' } : {}) } },
				[
					...(narrow.value
						? [
								h('div', { style: styles.topbar }, [
									h(
										'button',
										{
											type: 'button',
											style: styles.buttonGhost,
											'aria-label': 'Open menu',
											'aria-expanded': drawer.value,
											onClick: () => (drawer.value = true),
										},
										[icon('menu')],
									),
									h('span', { style: { fontWeight: 600, fontSize: '14px' } }, title),
									props.envLabel
										? h('span', { style: { ...styles.badge, marginLeft: 'auto' } }, props.envLabel)
										: null,
								]),
								drawer.value
									? h('div', { style: styles.drawer }, [
											nav(),
											h('div', {
												style: styles.scrim,
												'aria-hidden': 'true',
												onClick: () => (drawer.value = false),
											}),
										])
									: null,
							]
						: [nav()]),
					h('main', { class: 'fonderie-admin-main', style: styles.main }, body()),
				],
			);
		};
	},
});
