<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-admin-screens — signatures

## @fonderie/vue-admin-screens

```ts
type AdminPage = 'attention' | 'modules' | 'doctor' | 'environment' | 'routes' | 'migrations' | 'tokens' | 'operators' | 'log' | 'settings' | 'templates' | 'users' | 'catalog' | 'subscriber' | 'audit';

component AdminLogScreen(props: { client, pageSize, locale })

component AdminShell(props: { client, configClient, courierClient, authClient, billingClient, auditClient, environment, page, appName, envLabel, operators, currentOperator, publicConfigUrl, locale }) — emits: navigate

component AttentionScreen(props: { client, locale })

component EnvironmentScreen(props: { client, locale })

component DoctorScreen(props: { client, locale })

component ModulesScreen(props: { client, locale })

component RoutesScreen(props: { client, locale })

component TokensScreen(props: { client, locale })

component OperatorsScreen(props: { client, me, locale })

component MigrationsScreen(props: { client, locale })

component UsersScreen(props: { client, pageSize, billingClient, openUserId, locale })

component CatalogScreen(props: { client, locale })

component SubscriberScreen(props: { client, pageSize, onOpenUser, locale })

component SubscriberBilling(props: { client, subscriberType, subscriberId, locale })

component AuditScreen(props: { client, pageSize, locale })
```
