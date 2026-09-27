import {
	type AdminClient,
	type AdminLocale,
	type AdminMessageKey,
	type AuditAdminClient,
	type AuthAdminClient,
	type BillingAdminClient,
	type ConfigAdminClient,
	type CourierAdminClient,
	createAdminT,
} from '@fonderie/client';
import { ConfigEditorScreen, ConfigListScreen } from '@fonderie/react-config-admin-screens';
import {
	TemplateCreateScreen,
	TemplateEditorScreen,
	TemplateListScreen,
} from '@fonderie/react-courier-admin-screens';
import { type ReactNode, useEffect, useState } from 'react';
import type { IconName } from '../icons';
import { styles } from '../styles';
import { Icon } from '../ui';
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

export interface IAdminShellProps {
	client: AdminClient;
	// Given ⇒ the Settings (config + secrets) and Messaging (templates) pages
	// appear. Construct them with `prefix: '/_admin'` to go through the one token.
	configClient?: ConfigAdminClient;
	courierClient?: CourierAdminClient;
	// Given ⇒ the People page (users) appears; needs @fonderie/auth ≥ 7.8.
	authClient?: AuthAdminClient;
	// Given ⇒ the Money pages (catalog, subscriber) appear; needs @fonderie/billing ≥ 9.10.
	billingClient?: BillingAdminClient;
	// Given ⇒ the Audit page appears; needs @fonderie/audit ≥ 5.2.
	auditClient?: AuditAdminClient;
	environment?: string;
	// Controlled navigation: pass both to own the URL. Omit both and the shell
	// keeps the page itself.
	page?: AdminPage;
	onNavigate?: (page: AdminPage) => void;
	// Shown at the top of the sidebar. Defaults to "Admin".
	appName?: string;
	// A badge beside the name — the deployment's environment ("production").
	// Production is tinted so an operator always knows where their clicks land.
	envLabel?: string;
	// Pinned to the bottom of the sidebar: session controls (theme, sign out).
	footer?: ReactNode;
	// The deployment has operator accounts (@fonderie/admin with a store):
	// shows the Operators page.
	operators?: boolean;
	// The signed-in operator's email, when a person (not a token) is signed in.
	currentOperator?: string;
	// Where the app serves GET /config/public — marks public keys on the
	// Config page and previews exactly what frontends receive.
	publicConfigUrl?: string;
	// The console's own language (the operator's choice, independent of the
	// locales the app serves). Default English.
	locale?: AdminLocale | undefined;
}

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
function useNarrow(): boolean {
	const query =
		typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW) : null;
	const [narrow, setNarrow] = useState(() => query?.matches ?? false);
	useEffect(() => {
		if (!query) return;
		const on = (e: MediaQueryListEvent) => setNarrow(e.matches);
		query.addEventListener('change', on);
		return () => query.removeEventListener('change', on);
	}, [query]);
	return narrow;
}

const NAV: Array<{
	group: AdminMessageKey;
	items: Array<{
		page: AdminPage;
		label: AdminMessageKey;
		needs?: 'config' | 'courier' | 'auth' | 'billing' | 'audit' | 'operators';
	}>;
}> = [
	{ group: 'nav.groups.today', items: [{ page: 'attention', label: 'nav.items.attention' }] },
	{
		group: 'nav.groups.system',
		items: [
			{ page: 'modules', label: 'nav.items.modules' },
			{ page: 'environment', label: 'nav.items.environment' },
			{ page: 'doctor', label: 'nav.items.doctor' },
			{ page: 'routes', label: 'nav.items.routes' },
		],
	},
	{
		group: 'nav.groups.people',
		items: [{ page: 'users', label: 'nav.items.users', needs: 'auth' }],
	},
	{
		group: 'nav.groups.money',
		items: [
			{ page: 'catalog', label: 'nav.items.catalog', needs: 'billing' },
			{ page: 'subscriber', label: 'nav.items.subscriptions', needs: 'billing' },
		],
	},
	{
		group: 'nav.groups.settings',
		items: [{ page: 'settings', label: 'nav.items.settings', needs: 'config' }],
	},
	{
		group: 'nav.groups.messaging',
		items: [{ page: 'templates', label: 'nav.items.templates', needs: 'courier' }],
	},
	{
		group: 'nav.groups.activity',
		items: [
			{ page: 'audit', label: 'nav.items.audit', needs: 'audit' },
			{ page: 'log', label: 'nav.items.log' },
			{ page: 'operators', label: 'nav.items.operators', needs: 'operators' },
			{ page: 'tokens', label: 'nav.items.tokens' },
			{ page: 'migrations', label: 'nav.items.migrations' },
		],
	},
];

export function AdminShell({
	client,
	configClient,
	courierClient,
	authClient,
	billingClient,
	auditClient,
	environment,
	page,
	onNavigate,
	appName = 'Admin',
	envLabel,
	footer,
	operators = false,
	currentOperator,
	publicConfigUrl,
	locale,
}: IAdminShellProps) {
	const t = createAdminT(locale);
	const narrow = useNarrow();
	const [drawer, setDrawer] = useState(false);
	const [own, setOwn] = useState<AdminPage>('attention');
	// A user opened from Subscriptions: their billing lives on the Users page.
	const [openUser, setOpenUser] = useState<string | undefined>(undefined);
	const current = page ?? own;
	const go = (p: AdminPage) => {
		if (onNavigate) onNavigate(p);
		if (page === undefined) setOwn(p);
		setDrawer(false);
	};
	// What is open, and exactly which row: the same key exists per environment
	// and the same template per locale — dropping either opened the wrong row.
	const [editing, setEditing] = useState<
		| { kind: 'config' | 'secret'; key: string; environment?: string; environments?: string[] }
		| { kind: 'template'; type: string; locale: string | null; system: boolean }
		| { kind: 'template-new'; type?: string; locales?: string[]; defaultLocale?: string }
		| null
	>(null);

	const has = {
		config: Boolean(configClient),
		courier: Boolean(courierClient),
		auth: Boolean(authClient),
		billing: Boolean(billingClient),
		audit: Boolean(auditClient),
		operators,
	};

	let body: React.ReactNode;
	switch (current) {
		case 'attention':
			body = <AttentionScreen client={client} locale={locale} />;
			break;
		case 'modules':
			body = <ModulesScreen client={client} locale={locale} />;
			break;
		case 'doctor':
			body = <DoctorScreen client={client} locale={locale} />;
			break;
		case 'environment':
			body = <EnvironmentScreen client={client} locale={locale} />;
			break;
		case 'routes':
			body = <RoutesScreen client={client} locale={locale} />;
			break;
		case 'tokens':
			body = <TokensScreen client={client} locale={locale} />;
			break;
		case 'operators':
			body = <OperatorsScreen client={client} me={currentOperator} locale={locale} />;
			break;
		case 'migrations':
			body = <MigrationsScreen client={client} locale={locale} />;
			break;
		case 'log':
			body = <AdminLogScreen client={client} locale={locale} />;
			break;
		case 'catalog':
			body = billingClient ? (
				<CatalogScreen client={billingClient} locale={locale} />
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					{t('shell.missingClient', { client: 'BillingAdminClient' })}
				</p>
			);
			break;
		case 'subscriber':
			body = billingClient ? (
				<SubscriberScreen
					client={billingClient}
					locale={locale}
					{...(authClient
						? {
								onOpenUser: (id: string) => {
									setOpenUser(id);
									go('users');
								},
							}
						: {})}
				/>
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					{t('shell.missingClient', { client: 'BillingAdminClient' })}
				</p>
			);
			break;
		case 'audit':
			body = auditClient ? (
				<AuditScreen client={auditClient} locale={locale} />
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					{t('shell.missingClient', { client: 'AuditAdminClient' })}
				</p>
			);
			break;
		case 'users':
			body = authClient ? (
				<UsersScreen
					key={openUser ?? 'list'}
					client={authClient}
					billingClient={billingClient}
					openUserId={openUser}
					locale={locale}
				/>
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					{t('shell.missingClient', { client: 'AuthAdminClient' })}
				</p>
			);
			break;
		case 'settings':
			body = !configClient ? (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					{t('shell.missingClient', { client: 'ConfigAdminClient' })}
				</p>
			) : editing && (editing.kind === 'config' || editing.kind === 'secret') ? (
				<>
					<div style={{ padding: '24px 40px 0' }}>
						<button type="button" style={styles.buttonGhost} onClick={() => setEditing(null)}>
							<Icon name="back" size={14} />
							{t('nav.items.settings')}
						</button>
					</div>
					<ConfigEditorScreen
						key={`${editing.kind}:${editing.key}:${editing.environment ?? ''}`}
						client={configClient}
						kind={editing.kind}
						configKey={editing.key}
						{...(editing.environment !== undefined
							? { environment: editing.environment }
							: environment !== undefined
								? { environment }
								: {})}
						{...(editing.environments ? { environments: editing.environments } : {})}
						onSaved={() => setEditing(null)}
						onDeleted={() => setEditing(null)}
						locale={locale}
					/>
				</>
			) : (
				<ConfigListScreen
					client={configClient}
					locale={locale}
					{...(environment !== undefined ? { environment } : {})}
					{...(publicConfigUrl ? { publicConfigUrl } : {})}
					onSelectConfig={(key, env) => setEditing({ kind: 'config', key, environment: env })}
					onSelectSecret={(key, env) => setEditing({ kind: 'secret', key, environment: env })}
					onCreateConfig={(c) =>
						setEditing({
							kind: 'config',
							key: '',
							environments: c.environments,
							...(c.environment ? { environment: c.environment } : {}),
						})
					}
					onCreateSecret={(c) =>
						setEditing({
							kind: 'secret',
							key: '',
							environments: c.environments,
							...(c.environment ? { environment: c.environment } : {}),
						})
					}
				/>
			);
			break;
		case 'templates':
			body = !courierClient ? (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					{t('shell.missingClient', { client: 'CourierAdminClient' })}
				</p>
			) : editing?.kind === 'template-new' ? (
				<>
					<div style={{ padding: '24px 40px 0' }}>
						<button type="button" style={styles.buttonGhost} onClick={() => setEditing(null)}>
							<Icon name="back" size={14} />
							{t('nav.items.templates')}
						</button>
					</div>
					<TemplateCreateScreen
						client={courierClient}
						locale={locale}
						{...(editing.type ? { type: editing.type } : {})}
						{...(editing.locales ? { locales: editing.locales } : {})}
						{...(editing.defaultLocale ? { defaultLocale: editing.defaultLocale } : {})}
						onCreated={(c) =>
							setEditing({ kind: 'template', type: c.type, locale: c.locale, system: false })
						}
					/>
				</>
			) : editing?.kind === 'template' ? (
				<>
					<div style={{ padding: '24px 40px 0' }}>
						<button type="button" style={styles.buttonGhost} onClick={() => setEditing(null)}>
							<Icon name="back" size={14} />
							{t('nav.items.templates')}
						</button>
					</div>
					<TemplateEditorScreen
						key={`${editing.type}:${editing.locale ?? ''}`}
						client={courierClient}
						type={editing.type}
						locale={editing.locale}
						system={editing.system}
						onSaved={() => setEditing(null)}
						onDeleted={() => setEditing(null)}
						onAddLocale={(type, c) =>
							setEditing({
								kind: 'template-new',
								type,
								locales: c.locales,
								...(c.defaultLocale ? { defaultLocale: c.defaultLocale } : {}),
							})
						}
						onSelectLocale={(tpl) =>
							setEditing({
								kind: 'template',
								type: tpl.type,
								locale: tpl.locale,
								system: tpl.system === true,
							})
						}
						uiLocale={locale}
					/>
				</>
			) : (
				<TemplateListScreen
					client={courierClient}
					locale={locale}
					onSelectTemplate={(tpl) =>
						setEditing({ kind: 'template', type: tpl.type, locale: tpl.locale, system: tpl.system })
					}
					onCreateTemplate={(c) => setEditing({ kind: 'template-new', locales: c.locales })}
				/>
			);
			break;
	}

	const production = envLabel ? /^prod/i.test(envLabel) : false;
	const brand = (
		<div style={styles.navBrand}>
			<div style={styles.navMark}>
				<Icon name="mark" size={15} />
			</div>
			<div style={{ minWidth: 0, flex: 1 }}>
				<div style={styles.navBrandTitle}>{appName}</div>
				{envLabel ? (
					<span
						style={{
							...styles.badge,
							marginTop: 3,
							padding: '0 7px',
							fontSize: 11,
							...(production
								? {
										color: 'var(--fonderie-danger,#e00)',
										borderColor: 'color-mix(in srgb, var(--fonderie-danger,#e00) 35%, transparent)',
									}
								: {}),
						}}
					>
						{envLabel}
					</span>
				) : null}
			</div>
			{narrow ? (
				<button
					type="button"
					style={styles.buttonGhost}
					aria-label={t('shell.closeMenu')}
					onClick={() => setDrawer(false)}
				>
					<Icon name="close" />
				</button>
			) : null}
		</div>
	);

	const nav = (
		<nav
			style={{
				...styles.nav,
				...(narrow
					? { width: 280, maxWidth: '85vw', boxShadow: '0 10px 40px rgba(0,0,0,.25)' }
					: {}),
			}}
			aria-label={t('shell.navLabel')}
		>
			{brand}
			<div style={styles.navScroll}>
				{NAV.map((g) => {
					const items = g.items.filter((i) => !i.needs || has[i.needs]);
					if (items.length === 0) return null;
					return (
						<div key={g.group}>
							<div style={styles.navGroup}>{t(g.group)}</div>
							{items.map((i) => {
								const active = current === i.page;
								return (
									<button
										key={i.page}
										type="button"
										className="fonderie-admin-nav-item"
										style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}
										aria-current={active ? 'page' : undefined}
										onClick={() => {
											setEditing(null);
											setOpenUser(undefined);
											go(i.page);
										}}
									>
										<Icon name={ICON[i.page]} style={active ? styles.navIconActive : undefined} />
										{t(i.label)}
									</button>
								);
							})}
						</div>
					);
				})}
			</div>
			{footer ? <div style={styles.navFooter}>{footer}</div> : null}
		</nav>
	);

	const titleKey = NAV.flatMap((g) => g.items).find((i) => i.page === current)?.label;
	const title = titleKey ? t(titleKey) : '';

	return (
		<div style={{ ...styles.shell, ...(narrow ? { flexDirection: 'column' } : {}) }}>
			{narrow ? (
				<>
					<div style={styles.topbar}>
						<button
							type="button"
							style={styles.buttonGhost}
							aria-label={t('shell.openMenu')}
							aria-expanded={drawer}
							onClick={() => setDrawer(true)}
						>
							<Icon name="menu" />
						</button>
						<span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
						{envLabel ? (
							<span style={{ ...styles.badge, marginLeft: 'auto' }}>{envLabel}</span>
						) : null}
					</div>
					{drawer ? (
						<div style={styles.drawer}>
							{nav}
							<div style={styles.scrim} onClick={() => setDrawer(false)} aria-hidden="true" />
						</div>
					) : null}
				</>
			) : (
				nav
			)}
			<main className="fonderie-admin-main" style={styles.main}>
				{body}
			</main>
		</div>
	);
}
