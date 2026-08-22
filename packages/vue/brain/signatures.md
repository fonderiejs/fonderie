<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue — signatures

## @fonderie/vue

```ts
new FonderieClient(opts: IFonderieClientOptions): FonderieClient
  .auth: AuthClient
  .billing: BillingClient
  .workspaces: WorkspacesClient
  .audit: AuditClient
  .webhooks: WebhooksClient
  .customers: CustomersClient
  .setAccessToken(token: string | undefined): void
  .clearCache(): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .request<T = unknown>(opts: { method: string; path: string; body?: unknown; token?: string | undefined; workspaceId?: string | undefined; cache?: number | false | undefined; bust?: boolean | undefined; invalidate?: string[] | undefined; }): Promise<...>
  .get<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .post<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .put<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .patch<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .delete<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>

const FONDERIE_INJECTION_KEY: symbol & InjectionConstraint<FonderieClient>

const FonderiePlugin: import("vue").ObjectPlugin<[FonderieClient]> | import("vue").FunctionPlugin<[FonderieClient]>

function provideFonderie(client: FonderieClient): void

function useFonderieClient(): FonderieClient

function useFonderieSubClient<T>(explicit: T | undefined, select: (client: FonderieClient) => T, composableName: string): T
```
