import type {
	AdminClient,
	AuthAdminClient,
	BillingAdminClient,
	ConfigAdminClient,
	CourierAdminClient,
} from '@fonderie/client';
import { ConfigEditorScreen, ConfigListScreen } from '@fonderie/react-config-admin-screens';
import { TemplateEditorScreen, TemplateListScreen } from '@fonderie/react-courier-admin-screens';
import { useState } from 'react';
import { styles } from '../styles';
import { AdminLogScreen } from './AdminLogScreen';
import { AttentionScreen } from './AttentionScreen';
import { ConfigScreen } from './ConfigScreen';
import { DoctorScreen } from './DoctorScreen';
import { ModulesScreen } from './ModulesScreen';
import { RoutesScreen } from './RoutesScreen';
import { TokensScreen } from './TokensScreen';
import { UsersScreen } from './UsersScreen';
import { CatalogScreen } from './CatalogScreen';
import { SubscriberScreen } from './SubscriberScreen';

export type AdminPage =
	| 'attention'
	| 'modules'
	| 'doctor'
	| 'config'
	| 'routes'
	| 'tokens'
	| 'log'
	| 'settings'
	| 'templates'
	| 'users'
	| 'catalog'
	| 'subscriber';

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
	environment?: string;
	// Controlled navigation: pass both to own the URL. Omit both and the shell
	// keeps the page itself.
	page?: AdminPage;
	onNavigate?: (page: AdminPage) => void;
}

const NAV: Array<{
	group: string;
	items: Array<{
		page: AdminPage;
		label: string;
		needs?: 'config' | 'courier' | 'auth' | 'billing';
	}>;
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
			{ page: 'log', label: 'Admin log' },
			{ page: 'tokens', label: 'Access' },
		],
	},
];

export function AdminShell({
	client,
	configClient,
	courierClient,
	authClient,
	billingClient,
	environment,
	page,
	onNavigate,
}: IAdminShellProps) {
	const [own, setOwn] = useState<AdminPage>('attention');
	const current = page ?? own;
	const go = (p: AdminPage) => {
		if (onNavigate) onNavigate(p);
		if (page === undefined) setOwn(p);
	};
	const [editing, setEditing] = useState<
		{ kind: 'config' | 'secret'; key: string } | { kind: 'template'; type: string } | null
	>(null);

	const has = {
		config: Boolean(configClient),
		courier: Boolean(courierClient),
		auth: Boolean(authClient),
		billing: Boolean(billingClient),
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
		case 'config':
			body = <ConfigScreen client={client} />;
			break;
		case 'routes':
			body = <RoutesScreen client={client} />;
			break;
		case 'tokens':
			body = <TokensScreen client={client} />;
			break;
		case 'log':
			body = <AdminLogScreen client={client} />;
			break;
		case 'catalog':
			body = billingClient ? (
				<CatalogScreen client={billingClient} />
			) : (
				<p style={styles.status}>Pass a BillingAdminClient to see the catalog here.</p>
			);
			break;
		case 'subscriber':
			body = billingClient ? (
				<SubscriberScreen client={billingClient} />
			) : (
				<p style={styles.status}>Pass a BillingAdminClient to look up subscribers here.</p>
			);
			break;
		case 'users':
			body = authClient ? (
				<UsersScreen client={authClient} />
			) : (
				<p style={styles.status}>Pass an AuthAdminClient to look up users here.</p>
			);
			break;
		case 'settings':
			body = !configClient ? (
				<p style={styles.status}>Pass a ConfigAdminClient to manage config and secrets here.</p>
			) : editing && editing.kind !== 'template' ? (
				<>
					<button type="button" style={styles.button} onClick={() => setEditing(null)}>
						← Back
					</button>
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
				/>
			);
			break;
		case 'templates':
			body = !courierClient ? (
				<p style={styles.status}>Pass a CourierAdminClient to manage templates here.</p>
			) : editing?.kind === 'template' ? (
				<>
					<button type="button" style={styles.button} onClick={() => setEditing(null)}>
						← Back
					</button>
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

	return (
		<div style={styles.shell}>
			<nav style={styles.nav} aria-label="Admin">
				{NAV.map((g) => {
					const items = g.items.filter((i) => !i.needs || has[i.needs]);
					if (items.length === 0) return null;
					return (
						<div key={g.group}>
							<div style={styles.navGroup}>{g.group}</div>
							{items.map((i) => (
								<button
									key={i.page}
									type="button"
									style={{ ...styles.navItem, ...(current === i.page ? styles.navItemActive : {}) }}
									aria-current={current === i.page ? 'page' : undefined}
									onClick={() => {
										setEditing(null);
										go(i.page);
									}}
								>
									{i.label}
								</button>
							))}
						</div>
					);
				})}
			</nav>
			<main style={styles.main}>{body}</main>
		</div>
	);
}
