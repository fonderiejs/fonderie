<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-admin-screens — signatures

## @fonderie/react-admin-screens

```ts
type AdminPage = 'attention' | 'modules' | 'doctor' | 'environment' | 'routes' | 'migrations' | 'tokens' | 'operators' | 'log' | 'settings' | 'templates' | 'users' | 'catalog' | 'subscriber' | 'audit';

interface IAdminLogScreenProps {
    client: AdminClient;
    pageSize?: number;
    locale?: AdminLocale | undefined;
}

interface IAdminShellProps {
    client: AdminClient;
    configClient?: ConfigAdminClient;
    courierClient?: CourierAdminClient;
    authClient?: AuthAdminClient;
    billingClient?: BillingAdminClient;
    auditClient?: AuditAdminClient;
    environment?: string;
    page?: AdminPage;
    onNavigate?: (page: AdminPage) => void;
    appName?: string;
    envLabel?: string;
    footer?: ReactNode;
    operators?: boolean;
    currentOperator?: string;
    publicConfigUrl?: string;
    locale?: AdminLocale | undefined;
}

interface IAttentionScreenProps {
    client: AdminClient;
    locale?: AdminLocale | undefined;
}

interface IEnvironmentScreenProps {
    client: AdminClient;
    locale?: AdminLocale | undefined;
}

interface IDoctorScreenProps {
    client: AdminClient;
    locale?: AdminLocale | undefined;
}

interface IModulesScreenProps {
    client: AdminClient;
    locale?: AdminLocale | undefined;
}

interface IRoutesScreenProps {
    client: AdminClient;
    locale?: AdminLocale | undefined;
}

interface ITokensScreenProps {
    client: AdminClient;
    locale?: AdminLocale | undefined;
}

interface IOperatorsScreenProps {
    client: AdminClient;
    me?: string | undefined;
    locale?: AdminLocale | undefined;
}

interface IMigrationsScreenProps {
    client: AdminClient;
    locale?: AdminLocale | undefined;
}

interface IUsersScreenProps {
    client: AuthAdminClient;
    pageSize?: number;
    billingClient?: BillingAdminClient | undefined;
    openUserId?: string | undefined;
    locale?: AdminLocale | undefined;
}

interface IErasuresPanelProps {
    client: AuthAdminClient;
    email?: string | undefined;
    pageSize?: number;
    locale?: AdminLocale | undefined;
}

interface ICatalogScreenProps {
    client: BillingAdminClient;
    locale?: AdminLocale | undefined;
}

interface ISubscriberScreenProps {
    client: BillingAdminClient;
    pageSize?: number;
    onOpenUser?: (userId: string) => void;
    locale?: AdminLocale | undefined;
}

interface ISubscriberBillingProps {
    client: BillingAdminClient;
    subscriber: {
        type: SubscriberType;
        id: string;
    };
    locale?: AdminLocale | undefined;
}

interface IAuditScreenProps {
    client: AuditAdminClient;
    pageSize?: number;
    locale?: AdminLocale | undefined;
}

function AdminLogScreen({ client, pageSize, locale }: IAdminLogScreenProps): Element

function AdminShell({ client, configClient, courierClient, authClient, billingClient, auditClient, environment, page, onNavigate, appName, envLabel, footer, operators, currentOperator, publicConfigUrl, locale, }: IAdminShellProps): Element

function AttentionScreen({ client, locale }: IAttentionScreenProps): Element

function EnvironmentScreen({ client, locale }: IEnvironmentScreenProps): Element

function DoctorScreen({ client, locale }: IDoctorScreenProps): Element

function ModulesScreen({ client, locale }: IModulesScreenProps): Element

function RoutesScreen({ client, locale }: IRoutesScreenProps): Element

function TokensScreen({ client, locale }: ITokensScreenProps): Element

function OperatorsScreen({ client, me, locale }: IOperatorsScreenProps): Element

function MigrationsScreen({ client, locale }: IMigrationsScreenProps): Element

function UsersScreen({ client, pageSize, billingClient, openUserId, locale, }: IUsersScreenProps): Element

function ErasuresPanel({ client, email, pageSize, locale }: IErasuresPanelProps): Element

function CatalogScreen({ client, locale }: ICatalogScreenProps): Element

function SubscriberScreen({ client, pageSize, onOpenUser, locale, }: ISubscriberScreenProps): Element

function SubscriberBilling({ client, subscriber, locale }: ISubscriberBillingProps): Element

function AuditScreen({ client, pageSize, locale }: IAuditScreenProps): Element
```
