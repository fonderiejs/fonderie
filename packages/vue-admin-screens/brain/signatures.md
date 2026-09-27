<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-admin-screens — signatures

## @fonderie/vue-admin-screens

```ts
type AdminPage = 'attention' | 'modules' | 'doctor' | 'environment' | 'routes' | 'migrations' | 'tokens' | 'operators' | 'log' | 'settings' | 'templates' | 'users' | 'catalog' | 'subscriber' | 'audit';

component AdminLogScreen(props: { client, pageSize })

component AdminShell(props: { client, configClient, courierClient, authClient, billingClient, auditClient, environment, page, appName, envLabel, operators, currentOperator }) — emits: navigate

component AttentionScreen(props: { client })

component EnvironmentScreen(props: { client })

component DoctorScreen(props: { client })

component ModulesScreen(props: { client })

component RoutesScreen(props: { client })

component TokensScreen(props: { client })

component OperatorsScreen(props: { client, me })

component MigrationsScreen(props: { client })

component UsersScreen(props: { client, pageSize, billingClient, openUserId })

component CatalogScreen(props: { client })

component SubscriberScreen(props: { client, pageSize, onOpenUser })

component SubscriberBilling(props: { client, subscriberType, subscriberId })

component AuditScreen(props: { client, pageSize })
```
