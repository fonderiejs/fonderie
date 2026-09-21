<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-admin-screens — signatures

## @fonderie/react-admin-screens

```ts
type AdminPage = 'attention' | 'modules' | 'doctor' | 'config' | 'routes' | 'tokens' | 'log' | 'settings' | 'templates';

interface IAdminLogScreenProps {
    client: AdminClient;
    pageSize?: number;
}

interface IAdminShellProps {
    client: AdminClient;
    configClient?: ConfigAdminClient;
    courierClient?: CourierAdminClient;
    environment?: string;
    page?: AdminPage;
    onNavigate?: (page: AdminPage) => void;
}

interface IAttentionScreenProps {
    client: AdminClient;
}

interface IConfigScreenProps {
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

function AdminLogScreen({ client, pageSize }: IAdminLogScreenProps): Element

function AdminShell({ client, configClient, courierClient, environment, page, onNavigate, }: IAdminShellProps): Element

function AttentionScreen({ client }: IAttentionScreenProps): Element

function ConfigScreen({ client }: IConfigScreenProps): Element

function DoctorScreen({ client }: IDoctorScreenProps): Element

function ModulesScreen({ client }: IModulesScreenProps): Element

function RoutesScreen({ client }: IRoutesScreenProps): Element

function TokensScreen({ client }: ITokensScreenProps): Element
```
