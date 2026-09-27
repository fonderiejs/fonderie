import type {
	AdminClient,
	AuditAdminClient,
	AuthAdminClient,
	BillingAdminClient,
	ConfigAdminClient,
	CourierAdminClient,
} from '@fonderie/client';
import { ConfigEditorScreen, ConfigListScreen } from '@fonderie/react-config-admin-screens';
import { TemplateEditorScreen, TemplateListScreen } from '@fonderie/react-courier-admin-screens';
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
			{ page: 'subscriber', label: 'Subscriber', needs: 'billing' },
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
}: IAdminShellProps) {
	const narrow = useNarrow();
	const [drawer, setDrawer] = useState(false);
	const [own, setOwn] = useState<AdminPage>('attention');
	const current = page ?? own;
	const go = (p: AdminPage) => {
		if (onNavigate) onNavigate(p);
		if (page === undefined) setOwn(p);
		setDrawer(false);
	};
	const [editing, setEditing] = useState<
		{ kind: 'config' | 'secret'; key: string } | { kind: 'template'; type: string } | null
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
			body = <AttentionScreen client={client} />;
			break;
		case 'modules':
			body = <ModulesScreen client={client} />;
			break;
		case 'doctor':
			body = <DoctorScreen client={client} />;
			break;
		case 'environment':
			body = <EnvironmentScreen client={client} />;
			break;
		case 'routes':
			body = <RoutesScreen client={client} />;
			break;
		case 'tokens':
			body = <TokensScreen client={client} />;
			break;
		case 'operators':
			body = <OperatorsScreen client={client} me={currentOperator} />;
			break;
		case 'migrations':
			body = <MigrationsScreen client={client} />;
			break;
		case 'log':
			body = <AdminLogScreen client={client} />;
			break;
		case 'catalog':
			body = billingClient ? (
				<CatalogScreen client={billingClient} />
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					Pass a BillingAdminClient to see the catalog here.
				</p>
			);
			break;
		case 'subscriber':
			body = billingClient ? (
				<SubscriberScreen client={billingClient} />
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					Pass a BillingAdminClient to look up subscribers here.
				</p>
			);
			break;
		case 'audit':
			body = auditClient ? (
				<AuditScreen client={auditClient} />
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					Pass an AuditAdminClient to see the audit trail here.
				</p>
			);
			break;
		case 'users':
			body = authClient ? (
				<UsersScreen client={authClient} />
			) : (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					Pass an AuthAdminClient to look up users here.
				</p>
			);
			break;
		case 'settings':
			body = !configClient ? (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					Pass a ConfigAdminClient to manage config and secrets here.
				</p>
			) : editing && editing.kind !== 'template' ? (
				<>
					<div style={{ padding: '24px 40px 0' }}>
						<button type="button" style={styles.buttonGhost} onClick={() => setEditing(null)}>
							<Icon name="back" size={14} />
							Config &amp; secrets
						</button>
					</div>
					<ConfigEditorScreen
						client={configClient}
						kind={editing.kind}
						configKey={editing.key}
						{...(environment !== undefined ? { environment } : {})}
						onSaved={() => setEditing(null)}
					/>
				</>
			) : (
				<ConfigListScreen
					client={configClient}
					{...(environment !== undefined ? { environment } : {})}
					onSelectConfig={(key) => setEditing({ kind: 'config', key })}
					onSelectSecret={(key) => setEditing({ kind: 'secret', key })}
					onCreateConfig={() => setEditing({ kind: 'config', key: '' })}
					onCreateSecret={() => setEditing({ kind: 'secret', key: '' })}
				/>
			);
			break;
		case 'templates':
			body = !courierClient ? (
				<p style={{ ...styles.status, padding: '32px 40px' }}>
					Pass a CourierAdminClient to manage templates here.
				</p>
			) : editing?.kind === 'template' ? (
				<>
					<div style={{ padding: '24px 40px 0' }}>
						<button type="button" style={styles.buttonGhost} onClick={() => setEditing(null)}>
							<Icon name="back" size={14} />
							Templates
						</button>
					</div>
					<TemplateEditorScreen
						client={courierClient}
						type={editing.type}
						onSaved={() => setEditing(null)}
					/>
				</>
			) : (
				<TemplateListScreen
					client={courierClient}
					onSelectTemplate={(t) => setEditing({ kind: 'template', type: t.type })}
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
					aria-label="Close menu"
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
			aria-label="Admin"
		>
			{brand}
			<div style={styles.navScroll}>
				{NAV.map((g) => {
					const items = g.items.filter((i) => !i.needs || has[i.needs]);
					if (items.length === 0) return null;
					return (
						<div key={g.group}>
							<div style={styles.navGroup}>{g.group}</div>
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
											go(i.page);
										}}
									>
										<Icon name={ICON[i.page]} style={active ? styles.navIconActive : undefined} />
										{i.label}
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

	const title = NAV.flatMap((g) => g.items).find((i) => i.page === current)?.label ?? '';

	return (
		<div style={{ ...styles.shell, ...(narrow ? { flexDirection: 'column' } : {}) }}>
			{narrow ? (
				<>
					<div style={styles.topbar}>
						<button
							type="button"
							style={styles.buttonGhost}
							aria-label="Open menu"
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
