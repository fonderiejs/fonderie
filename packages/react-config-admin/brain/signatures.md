<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-config-admin — signatures

## @fonderie/react-config-admin

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

interface IUseConfigEntriesReturn {
    entries: IConfigEntry[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseConfigEntryReturn {
    entry: IConfigEntry | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseConfigRevisionsReturn {
    revisions: IConfigRevision[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    rollback: (toVersion: number) => Promise<IConfigEntry>;
}

interface IUseDeleteConfigEntryReturn {
    deleteConfigEntry: (key: string, environment?: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseDeleteSecretReturn {
    deleteSecret: (key: string, environment?: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseRevealSecretReturn {
    revealSecret: (key: string, environment?: string) => Promise<string>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseSaveConfigEntryReturn {
    saveConfigEntry: (key: string, input: ISetConfigInput, environment?: string) => Promise<IConfigEntry>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseSaveSecretReturn {
    saveSecret: (key: string, input: ISetSecretInput, environment?: string) => Promise<ISecretEntry>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseSecretReturn {
    secret: ISecretEntry | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseSecretRevisionsReturn {
    revisions: ISecretRevision[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    rollback: (toVersion: number) => Promise<ISecretEntry>;
}

interface IUseSecretsReturn {
    secrets: ISecretEntry[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

function useConfigEntries(client: ConfigAdminClient, environment?: string | undefined): IUseConfigEntriesReturn

function useConfigEntry(client: ConfigAdminClient, key: string, environment?: string | undefined): IUseConfigEntryReturn

function useConfigRevisions(client: ConfigAdminClient, key: string, environment?: string | undefined): IUseConfigRevisionsReturn

function useDeleteConfigEntry(client: ConfigAdminClient): IUseDeleteConfigEntryReturn

function useDeleteSecret(client: ConfigAdminClient): IUseDeleteSecretReturn

function useRevealSecret(client: ConfigAdminClient): IUseRevealSecretReturn

function useSaveConfigEntry(client: ConfigAdminClient): IUseSaveConfigEntryReturn

function useSaveSecret(client: ConfigAdminClient): IUseSaveSecretReturn

function useSecret(client: ConfigAdminClient, key: string, environment?: string | undefined): IUseSecretReturn

function useSecretRevisions(client: ConfigAdminClient, key: string, environment?: string | undefined): IUseSecretRevisionsReturn

function useSecrets(client: ConfigAdminClient, environment?: string | undefined): IUseSecretsReturn
```
