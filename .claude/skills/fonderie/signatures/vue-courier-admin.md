<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-courier-admin — signatures

## @fonderie/vue-courier-admin

```ts
interface ICourierAdminClientOptions {
    baseUrl: string;
    adminToken: string;
    prefix?: string;
    actor?: string;
}

interface IPreviewTemplateInput {
    text: string;
    subject?: string;
    html?: string;
    data?: Record<string, unknown>;
}

interface IRenderedTemplateResult {
    subject?: string;
    html?: string;
    text: string;
    variables: string[];
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
  .previewTemplate(type: string, input: IPreviewTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<IRenderedTemplateResult>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown, requestId?: string | undefined): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .requestId: string | undefined
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useTemplate(client: CourierAdminClient, type: string, locale?: string | null | undefined): { template: Ref<{ type: string; locale: string | null; subject: string | null; ... 5 more ...; updatedAt: string; } | null, ITemplateEntry | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useTemplatePreview(client: CourierAdminClient): { preview: Ref<{ subject?: string; html?: string; text: string; variables: string[]; } | null, IRenderedTemplateResult | { ...; } | null>; isPreviewing: Ref<...>; error: Ref<...>; renderPreview: (type: string, input: IPreviewTemplateInput, locale?: string | ... 1 more ... | undefined) => Promise<...>; clearPreview: () => void; }

function useTemplateRevisions(client: CourierAdminClient, type: string, locale?: string | null | undefined): { revisions: Ref<{ type: string; locale: string | null; subject: string | null; ... 4 more ...; createdAt: string; }[], ITemplateRevision[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; rollback: (toVersion: number) => Promise<...>; }

function useTemplates(client: CourierAdminClient): { templates: Ref<{ type: string; locale: string | null; subject: string | null; html: string | null; text: string; active: boolean; version: number; updatedBy: string | null; updatedAt: string; }[], ITemplateEntry[] | { ...; }[]>; ... 4 more ...; removeTemplate: (type: string, locale?: string | ... 1 more ... | undefined) => Promise<...>; }
```
