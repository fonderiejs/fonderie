<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-courier-admin — signatures

## @fonderie/react-courier-admin

```ts
interface ICourierAdminClientOptions {
    baseUrl: string;
    adminToken: string;
}

interface IRollbackTemplateInput {
    toVersion: number;
}

interface ISetTemplateInput {
    text: string;
    subject?: string;
    html?: string;
    active?: boolean;
    ifVersion?: number;
}

interface ITemplateEntry {
    type: string;
    locale: string | null;
    subject: string | null;
    html: string | null;
    text: string;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface ITemplateRevision {
    type: string;
    locale: string | null;
    subject: string | null;
    html: string | null;
    text: string;
    version: number;
    actor: string | null;
    createdAt: string;
}

new CourierAdminClient(opts: ICourierAdminClientOptions): CourierAdminClient
  .listTemplates(): Promise<IApiResponse<ITemplateEntry[]>>
  .getTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .setTemplate(type: string, input: ISetTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .deleteTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<undefined>>
  .listRevisions(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateRevision[]>>
  .rollback(type: string, input: IRollbackTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IUseDeleteTemplateReturn {
    deleteTemplate: (type: string, locale?: string | null) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseSaveTemplateReturn {
    saveTemplate: (type: string, input: ISetTemplateInput, locale?: string | null) => Promise<ITemplateEntry>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseTemplateReturn {
    template: ITemplateEntry | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseTemplateRevisionsReturn {
    revisions: ITemplateRevision[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    rollback: (toVersion: number) => Promise<ITemplateEntry>;
}

interface IUseTemplatesReturn {
    templates: ITemplateEntry[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    saveTemplate: (type: string, input: ISetTemplateInput, locale?: string | null) => Promise<ITemplateEntry>;
    removeTemplate: (type: string, locale?: string | null) => Promise<void>;
}

function useDeleteTemplate(client: CourierAdminClient): IUseDeleteTemplateReturn

function useSaveTemplate(client: CourierAdminClient): IUseSaveTemplateReturn

function useTemplate(client: CourierAdminClient, type: string, locale?: string | null | undefined): IUseTemplateReturn

function useTemplateRevisions(client: CourierAdminClient, type: string, locale?: string | null | undefined): IUseTemplateRevisionsReturn

function useTemplates(client: CourierAdminClient): IUseTemplatesReturn
```
