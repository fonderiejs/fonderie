export type { IAuthErrorInfo, IClientAuthConfig, IFonderieClientOptions, IRequestConfig, SessionState } from './client';
export type { ICache, IMemoryCacheOptions } from './cache';
export { createMemoryCache } from './cache';
export { FonderieClient } from './client';
export { FonderieApiError, isSessionRefusal } from './http';
export type { IListAuditEventsInput } from './modules/audit';
export { AuditClient } from './modules/audit';
export type {
	IAppleNativeInput,
	IGoogleNativeInput,
	IChangePasswordInput,
	IGetLoginHistoryInput,
	ILoginInput,
	IRegisterInput,
	IResetPasswordInput,
	IUpdatePreferencesInput,
	IUpdateProfileInput,
	IRequestAccountDeletionInput,
	IRequestAccountDeletionResult,
	IConfirmAccountDeletionInput,
	IAccountDeletionResult,
	IRestoreAccountInput,
} from './modules/auth';
export { pendingDeletionOf } from './pending-deletion';
export type { IPendingDeletion } from './pending-deletion';
export { AuthClient } from './modules/auth';
export type {
	ICheckoutInput,
	ICreatePlanInput,
	IRecordUsageInput,
	IUpdatePlanInput,
	IWalletPreferencesInput,
} from './modules/billing';
export { BillingClient } from './modules/billing';
export type {
	IConfigAdminClientOptions,
	IRollbackInput,
	ISetConfigInput,
	ISetSecretInput,
} from './modules/config-admin';
export { ConfigAdminClient } from './modules/config-admin';
export type { IAdminClientOptions, IAdminLogQuery } from './modules/admin';
export { AdminClient } from './modules/admin';
export type {
	IAuthAdminClientOptions,
	IAdminLoginHistoryQuery,
	IAdminUsersQuery,
} from './modules/auth-admin';
export { AuthAdminClient } from './modules/auth-admin';
export type {
	IBillingAdminClientOptions,
	IAdminLedgerQuery,
	IAdminSubscriptionsQuery,
} from './modules/billing-admin';
export { BillingAdminClient } from './modules/billing-admin';
export type { IAuditAdminClientOptions, IAdminAuditQuery } from './modules/audit-admin';
export { AuditAdminClient } from './modules/audit-admin';
export type {
	ICourierAdminClientOptions,
	IPreviewTemplateInput,
	IRenderedTemplateResult,
	IRollbackTemplateInput,
	ISetTemplateInput,
} from './modules/courier-admin';
export { CourierAdminClient } from './modules/courier-admin';
export type { ITemplateGroup, ITemplateLanguage } from './template-locales';
export {
	groupTemplatesByType,
	missingTemplateLocales,
	suggestTemplateLocales,
	templateLanguages,
} from './template-locales';
export type {
	IAddAddressInput,
	IAddEmailInput,
	IAddPhoneInput,
	IAddRelationshipInput,
	IBlacklistCustomerInput,
	ICreateCustomerInput,
	IGetCustomerInput,
	IListCustomersInput,
	IUpdateCustomerInput,
} from './modules/customers';
export { CustomersClient } from './modules/customers';
export type { IUploadMediaInput } from './modules/media';
export { MediaClient } from './modules/media';
export type {
	ICreateWebhookEndpointInput,
	IUpdateWebhookEndpointInput,
} from './modules/webhooks';
export { WebhooksClient } from './modules/webhooks';
export type {
	ICreateRoleInput,
	ICreateWorkspaceInput,
	IInviteEntry,
	IRolePermission,
	IRolePermissionInput,
	IRolePermissionsResult,
	IUpdateRoleInput,
	IUpdateSettingsInput,
	IUpdateWorkspaceInput,
} from './modules/workspaces';
export { WorkspacesClient } from './modules/workspaces';
export type {
	CustomerLabelType,
	CustomerSex,
	CustomerType,
	IAcceptInvitationInput,
	IAcceptInvitationResult,
	IAddressDTO,
	IApiError,
	IApiResponse,
	IAuditEventDTO,
	IAuditPageResult,
	ILoginEventDTO,
	IRequestLocationDTO,
	IAdminUserPageResult,
	ILoginHistoryPageResult,
	ISessionDTO,
	ISessionsResult,
	ICancelSubscriptionInput,
	ICheckoutUrlResult,
	AdminRouteGuard,
	IAdminAttention,
	IAdminAttentionItem,
	IAdminFinding,
	IAdminReason,
	IAdminCheckResult,
	IAdminEnvironmentReport,
	IAdminDoctorReport,
	IAdminLogEntry,
	IAdminLogPage,
	IAdminManifest,
	IAdminModuleEntry,
	IAdminReadiness,
	IAdminReadinessProblem,
	IAdminRouteEntry,
	IAdminRoutesReport,
	IAdminTokensReport,
	AdminScope,
	IAdminTokenRecord,
	IAdminOperator,
	IAdminOperatorLink,
	IAdminOperatorsReport,
	IAdminCreatedLink,
	AdminSessionState,
	IAdminSession,
	IAdminEnrollment,
	IAdminSecondFactor,
	IAdminIssueTokenInput,
	IAdminIssuedToken,
	MigrationImpact,
	IAdminPendingMigration,
	IAdminMigrationModule,
	IAdminMigrationsReport,
	IAdminUserDTO,
	IAdminCatalog,
	IAdminSubscriptionDTO,
	IAdminWalletDTO,
	IAdminSubscriptionPage,
	IAdminWalletLedgerPage,
	IAdminPlanInput,
	IAdminGrantInput,
	IConfigEntry,
	IConfigRevision,
	ICustomerAddressDTO,
	ICustomerAddressListResult,
	ICustomerAddressResult,
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	ICustomerDTO,
	ICustomerEmailDTO,
	ICustomerEmailListResult,
	ICustomerEmailResult,
	ICustomerLabelDTO,
	ICustomerLabelListResult,
	ICustomerListResult,
	ICustomerNoteDTO,
	ICustomerNoteListResult,
	ICustomerNoteResult,
	ICustomerPhoneDTO,
	ICustomerPhoneListResult,
	ICustomerPhoneResult,
	ICustomerRelationshipDTO,
	ICustomerRelationshipExpandedD2DTO,
	ICustomerRelationshipExpandedDTO,
	ICustomerRelationshipListResult,
	ICustomerRelationshipResult,
	ICustomerResult,
	ICustomerShallowDTO,
	ICustomerTagListResult,
	IInvitationDTO,
	IInvitationListResult,
	IInviteResult,
	IInvoiceDTO,
	IInvoicesResult,
	ILoginResult,
	IMediaAssetDTO,
	IMediaAssetResult,
	IMemberDTO,
	IMemberRoleDTO,
	IInvitationResult,
	IMyPermissionsResult,
	IPermissionCatalogEntryDTO,
	IPermissionCatalogResult,
	IRoleDeleteResult,
	PermissionOperation,
	IMemberListResult,
	IMeResult,
	IMfaEnabledResult,
	IMfaRequiredResult,
	IMfaSetupResult,
	IPaymentMethodDTO,
	IPaymentMethodResult,
	IPlanDTO,
	IPlanFeature,
	IPlanListResult,
	IPlanResult,
	IPortalUrlResult,
	IRefreshResult,
	IReadOptions,
	IRegisterResult,
	IResendVerificationResult,
	IRevealSecretResult,
	IRoleDTO,
	IRoleListResult,
	IRoleResult,
	ISecretEntry,
	ISecretRevision,
	ISubscriptionChangeResult,
	ISubscriptionDTO,
	ISubscriptionResult,
	IBuiltInTemplate,
	ITemplateCatalog,
	ITemplateCatalogEntry,
	ITemplateResolution,
	ITemplateEntry,
	ITemplateRevision,
	ITestWebhookResult,
	ITokens,
	IUsageResult,
	IUserDTO,
	IUserPreferences,
	IVerifyEmailResult,
	IWalletCheckoutInput,
	IWalletDTO,
	IWalletPurchaseInput,
	IWalletPurchaseResult,
	IWalletResult,
	IWalletTransactionDTO,
	IWalletTransactionsResult,
	IWebhookDeliveryDTO,
	IWebhookDeliveryListResult,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	IWebhookEndpointListResult,
	IWorkspaceAddressDTO,
	IWorkspaceDTO,
	ITaxRegistrationDTO,
	IWorkspaceListResult,
	IWorkspaceResult,
	IWorkspaceSettingsDTO,
	IWorkspaceSettingsResult,
	SubscriberType,
} from './types';
export { isMfaRequired, describeLocation } from './types';
export {
	CONFIG_KEY_PATTERN,
	CONFIG_VALUE_TYPES,
	castConfigValue,
	configKeyProblem,
	configValueLabel,
	configValueType,
	formatConfigValue,
	inferConfigValue,
} from './config-value';
export type { CastResult, ConfigValueType, IInferredConfigValue } from './config-value';
export { ConfigClient, isSwitchOn } from './modules/config';
export { SseClient } from './modules/sse';
export type { FetchLike, ISseClientEvent, ISseSubscribeOptions, SseStatus } from './modules/sse';
export type { IClientLog, IConfigStorage, IRemoteConfigState } from './modules/config';
export {
	ADMIN_LOCALES,
	DEFAULT_ADMIN_LOCALE,
	adminLocaleNames,
	adminLocaleTags,
	createAdminT,
	detectAdminLocale,
	formatAdminDate,
	isAdminLocale,
	localizeReason,
} from './admin-i18n';
export type {
	AdminLocale,
	LocaleMap,
	AdminMessageKey,
	AdminMessageParams,
	AdminMessages,
	AdminT,
	IReasonLike,
} from './admin-i18n';

// The screens' shared read model (client.queries).
export { QueryStore, queryStoreFor, queryParams, deepEqual } from './query-store';
export type { IQueryEntry, IQueryFetchOptions, IQueryPersistOptions, IQueryStorage, IQueryStoreOptions } from './query-store';

// The prebuilt screens' words in en / fr / es / zh-Hans / zh-Hant, and the UI
// language every client carries (setLocale / getLocale / onLocaleChange).
export { UI_DICTIONARIES, UI_LANGUAGES, canonicalLocaleTag, createUiT, formatPersonName, localizeApiError, resolveUiLanguage } from './ui-i18n';
export type { IApiErrorLike, UiLanguage, UiMessageKey, UiMessageParams, UiMessages, UiT } from './ui-i18n';
export { UiLocale, detectDeviceLocale, uiLocaleFor } from './ui-locale';
