<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-admin-screens — signatures

## @fonderie/vue-admin-screens

```ts
type AdminPage = 'attention' | 'modules' | 'doctor' | 'config' | 'routes' | 'tokens' | 'log' | 'settings' | 'templates' | 'users' | 'catalog' | 'subscriber' | 'audit';

component AdminLogScreen(props: { client, pageSize })

component AdminShell(props: { client, configClient, courierClient, authClient, billingClient, auditClient, environment, page }) — emits: navigate

component AttentionScreen(props: { client })

component ConfigScreen(props: { client })

component DoctorScreen(props: { client })

component ModulesScreen(props: { client })

component RoutesScreen(props: { client })

component TokensScreen(props: { client })

component UsersScreen(props: { client })

component CatalogScreen(props: { client })

component SubscriberScreen(props: { client, pageSize })

component AuditScreen(props: { client, pageSize })
```
