<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-config-admin — signatures

## @fonderie/vue-config-admin

```ts
interface IConfigAdminClientOptions {
    baseUrl: string;
    adminToken: string;
}

interface IConfigEntry {
    key: string;
    value: unknown;
    environment: string;
    description: string | null;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface IConfigRevision {
    key: string;
    environment: string;
    value: unknown;
    version: number;
    actor: string | null;
    createdAt: string;
}

interface IRollbackInput {
    toVersion: number;
}

interface ISecretEntry {
    key: string;
    environment: string;
    description: string | null;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface ISecretRevision {
    key: string;
    environment: string;
    version: number;
    actor: string | null;
    createdAt: string;
}

interface ISetConfigInput {
    value: unknown;
    description?: string;
    ifVersion?: number;
}

interface ISetSecretInput {
    value: string;
    description?: string;
    ifVersion?: number;
}

new ConfigAdminClient(opts: IConfigAdminClientOptions): ConfigAdminClient
  .listConfig(environment?: string | undefined): Promise<IApiResponse<IConfigEntry[]>>
  .getConfig(key: string, environment?: string | undefined): Promise<IApiResponse<IConfigEntry>>
  .setConfig(key: string, input: ISetConfigInput, environment?: string | undefined): Promise<IApiResponse<IConfigEntry>>
  .deleteConfig(key: string, environment?: string | undefined): Promise<IApiResponse<undefined>>
  .listConfigRevisions(key: string, environment?: string | undefined): Promise<IApiResponse<IConfigRevision[]>>
  .rollbackConfig(key: string, input: IRollbackInput, environment?: string | undefined): Promise<IApiResponse<IConfigEntry>>
  .listSecrets(environment?: string | undefined): Promise<IApiResponse<ISecretEntry[]>>
  .getSecret(key: string, environment?: string | undefined): Promise<IApiResponse<ISecretEntry>>
  .setSecret(key: string, input: ISetSecretInput, environment?: string | undefined): Promise<IApiResponse<ISecretEntry>>
  .deleteSecret(key: string, environment?: string | undefined): Promise<IApiResponse<undefined>>
  .listSecretRevisions(key: string, environment?: string | undefined): Promise<IApiResponse<ISecretRevision[]>>
  .rollbackSecret(key: string, input: IRollbackInput, environment?: string | undefined): Promise<IApiResponse<ISecretEntry>>
  .revealSecret(key: string, environment?: string | undefined): Promise<IApiResponse<IRevealSecretResult>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useConfigEntries(client: ConfigAdminClient, environment?: string | undefined): { entries: Ref<{ key: string; value: unknown; environment: string; description: string | null; active: boolean; version: number; updatedBy: string | null; updatedAt: string; }[], IConfigEntry[] | { ...; }[]>; ... 4 more ...; removeEntry: (key: string) => Promise<...>; }

function useConfigEntry(client: ConfigAdminClient, key: string, environment?: string | undefined): { entry: Ref<{ key: string; value: unknown; environment: string; description: string | null; active: boolean; version: number; updatedBy: string | null; updatedAt: string; } | null, IConfigEntry | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useConfigRevisions(client: ConfigAdminClient, key: string, environment?: string | undefined): { revisions: Ref<{ key: string; environment: string; value: unknown; version: number; actor: string | null; createdAt: string; }[], IConfigRevision[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; rollback: (toVersion: number) => Promise<...>; }

function useDeleteConfigEntry(client: ConfigAdminClient): { deleteConfigEntry: (key: string, environment?: string | undefined) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<...>; }

function useDeleteSecret(client: ConfigAdminClient): { deleteSecret: (key: string, environment?: string | undefined) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<...>; }

function useRevealSecret(client: ConfigAdminClient): { revealSecret: (key: string, environment?: string | undefined) => Promise<string>; isLoading: Ref<boolean, boolean>; error: Ref<...>; }

function useSaveConfigEntry(client: ConfigAdminClient): { saveConfigEntry: (key: string, input: ISetConfigInput, environment?: string | undefined) => Promise<IConfigEntry>; isLoading: Ref<...>; error: Ref<...>; }

function useSaveSecret(client: ConfigAdminClient): { saveSecret: (key: string, input: ISetSecretInput, environment?: string | undefined) => Promise<ISecretEntry>; isLoading: Ref<...>; error: Ref<...>; }

function useSecret(client: ConfigAdminClient, key: string, environment?: string | undefined): { secret: Ref<{ key: string; environment: string; description: string | null; active: boolean; version: number; updatedBy: string | null; updatedAt: string; } | null, ISecretEntry | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useSecretRevisions(client: ConfigAdminClient, key: string, environment?: string | undefined): { revisions: Ref<{ key: string; environment: string; version: number; actor: string | null; createdAt: string; }[], ISecretRevision[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; rollback: (toVersion: number) => Promise<...>; }

function useSecrets(client: ConfigAdminClient, environment?: string | undefined): { secrets: Ref<{ key: string; environment: string; description: string | null; active: boolean; version: number; updatedBy: string | null; updatedAt: string; }[], ISecretEntry[] | { ...; }[]>; ... 4 more ...; removeSecret: (key: string) => Promise<...>; }
```
