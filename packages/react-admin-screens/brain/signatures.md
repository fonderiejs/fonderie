<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-admin-screens — signatures

## @fonderie/react-admin-screens

```ts
type AdminPage = 'attention' | 'modules' | 'doctor' | 'environment' | 'routes' | 'migrations' | 'tokens' | 'operators' | 'log' | 'settings' | 'templates' | 'users' | 'catalog' | 'subscriber' | 'audit';

interface IAdminLogScreenProps {
    client: AdminClient;
    pageSize?: number;
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
}

interface IAttentionScreenProps {
    client: AdminClient;
}

interface IEnvironmentScreenProps {
    client: AdminClient;
}

interface IDoctorScreenProps {
    client: AdminClient;
}

interface IModulesScreenProps {
    client: AdminClient;
}

interface IRoutesScreenProps {
    client: AdminClient;
}

interface ITokensScreenProps {
    client: AdminClient;
}

interface IOperatorsScreenProps {
    client: AdminClient;
    me?: string | undefined;
}

interface IMigrationsScreenProps {
    client: AdminClient;
}

interface IUsersScreenProps {
    client: AuthAdminClient;
    pageSize?: number;
}

interface ICatalogScreenProps {
    client: BillingAdminClient;
}

interface ISubscriberScreenProps {
    client: BillingAdminClient;
    pageSize?: number;
}

interface IAuditScreenProps {
    client: AuditAdminClient;
    pageSize?: number;
}

function AdminLogScreen({ client, pageSize }: IAdminLogScreenProps): Element

function AdminShell({ client, configClient, courierClient, authClient, billingClient, auditClient, environment, page, onNavigate, appName, envLabel, footer, operators, currentOperator, }: IAdminShellProps): Element

function AttentionScreen({ client }: IAttentionScreenProps): Element

function EnvironmentScreen({ client }: IEnvironmentScreenProps): Element

function DoctorScreen({ client }: IDoctorScreenProps): Element

function ModulesScreen({ client }: IModulesScreenProps): Element

function RoutesScreen({ client }: IRoutesScreenProps): Element

function TokensScreen({ client }: ITokensScreenProps): Element

function OperatorsScreen({ client, me }: IOperatorsScreenProps): Element

function MigrationsScreen({ client }: IMigrationsScreenProps): Element

function UsersScreen({ client, pageSize }: IUsersScreenProps): Element

function CatalogScreen({ client }: ICatalogScreenProps): Element

function SubscriberScreen({ client, pageSize }: ISubscriberScreenProps): Element

function AuditScreen({ client, pageSize }: IAuditScreenProps): Element
```
