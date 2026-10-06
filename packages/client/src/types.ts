// Per-call read options accepted by the typed sub-clients' GET methods.
export interface IReadOptions {
	// Ignore any cached value and refresh it (pull-to-refresh semantics).
	bust?: boolean | undefined;
}

// ── Envelope ─────────────────────────────────────────────────────────────────

export interface IApiResponse<T = undefined> {
	reason: string;
	explanation: string;
	result: T;
}

export interface IApiError {
	reason: string;
	explanation: string;
	details?: unknown;
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface IUserPreferences {
	locale: string;
	timezone: string;
	notifications: { email: boolean; inApp: boolean; sms: boolean; push: boolean };
	emailDigest: string;
	dateFormat: string;
	timeFormat: string;
}

export interface IUserDTO {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	phone: string;
	profileImageUrl: string;
	isActive: boolean;
	lastLogin: string;
	preferences: IUserPreferences;
	isEmailVerified: boolean;
	isPhoneVerified: boolean;
	mfaEnabled: boolean;
	// OAuth provider linked to this account ('google', 'apple'), or '' if none.
	provider: string;
	// Whether a password is set. With `provider`, this is what a settings screen
	// needs to render sign-in methods and to know whether unlinkOauth() can
	// succeed — an account with no password has no other credential, so the
	// server refuses (409 PASSWORD_REQUIRED) rather than locking the user out.
	hasPassword: boolean;
	suspended: boolean;
	whitelist: boolean;
	ipWhitelist: string[];
	createdAt: string;
	updatedAt: string;
}

export interface ITokens {
	access: string;
	refresh: string;
}

// ── Auth endpoint results ─────────────────────────────────────────────────────

/** What GET /auth/providers answers: the sign-in methods this API can honour. */
export interface IAuthProvidersResult {
	providers: string[];
}

export interface IRegisterResult {
	tokens: ITokens;
	user: IUserDTO;
	// True when the account still needs email verification (config-dependent;
	// route the user to the verify screen). Absent on phone and MFA/OAuth
	// completions, which don't compute it.
	requiresVerification?: boolean;
}

export interface ILoginResult {
	tokens: ITokens;
	user: IUserDTO;
	// True when the account still needs email verification (config-dependent;
	// route the user to the verify screen). Absent on phone and MFA/OAuth
	// completions, which don't compute it.
	requiresVerification?: boolean;
}

// Login response when the account has MFA enabled: no tokens yet — complete
// the login with auth.mfa.verifyLogin(mfaToken, code).
export interface IMfaRequiredResult {
	mfaToken: string;
}

export function isMfaRequired(
	result: ILoginResult | IMfaRequiredResult,
): result is IMfaRequiredResult {
	return !('tokens' in result);
}

export interface IRefreshResult {
	tokens: ITokens;
}

export interface IVerifyEmailResult {
	verified: boolean;
	email: string;
}

// GET /auth/send-verification: `{ email }` after a resend, `{ verified: true,
// email }` when the address was already verified, and no result at all on the
// phone branch — hence both fields optional. The verification pin itself is
// only ever emailed; it never appears in the response.
export interface IResendVerificationResult {
	email?: string;
	verified?: boolean;
}

export interface IMeResult {
	user: IUserDTO;
}

export interface IMfaSetupResult {
	// Data-URI QR code to scan, plus the one-time backup codes generated at
	// setup — matches @fonderie/auth's /auth/mfa/setup response.
	qr: string;
	backupCodes: string[];
}

// POST /auth/mfa/verify with a full session token (setup confirmation). The
// session token is NOT rotated — MFA is enforced at login, so the existing
// session stays valid unchanged. The `{ tokens, user }` response only exists
// on the mfa-pending login path, typed separately as ILoginResult (verifyLogin).
export interface IMfaEnabledResult {
	mfaEnabled: boolean;
}

// ── Billing ──────────────────────────────────────────────────────────────────

export interface IPlanFeature {
	name: string;
	description: string;
	enabled: boolean;
	limit?: number;
}

export interface IPlanDTO {
	id: string;
	planId: string;
	name: string;
	description: string;
	tier: number;
	seats: number | null;
	trialDays: number;
	pricing: {
		monthly: number; // in cents, e.g. 1999 = $19.99
		yearly: number; // in cents
		currency: string; // ISO 4217, e.g. 'USD'
	};
	/** True when pricing came from a stale cache — a provider outage or a
	 *  transfer window. Show prices as indicative when set. */
	pricingStale?: boolean;
	features: IPlanFeature[];
	metadata: Record<string, unknown>;
}

export type SubscriberType = 'user' | 'workspace';

export interface ISubscriptionDTO {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	plan: string;
	interval: string;
	status: string;
	cancelAtPeriodEnd: boolean;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	trialEndsAt: string | null;
	createdAt: string;
}

export interface IPlanListResult {
	plans: IPlanDTO[];
}

export interface IPlanResult {
	plan: IPlanDTO;
}

export interface ISubscriptionResult {
	subscription: ISubscriptionDTO;
}

export interface ICheckoutUrlResult {
	url: string;
}

export interface IPortalUrlResult {
	url: string;
}

export interface IUsageResult {
	metric: string;
	// 'counter' = a windowed plan limit (e.g. 'api-calls' per day) read from the
	// live counter; 'records' = the sum of POST /billing/usage records this
	// month. Absent from servers that predate it (records).
	kind?: 'counter' | 'records';
	// Used in the current window ('counter'), or recorded this month ('records').
	total: number;
	// Start of what `total` covers (the window, or the month).
	since: string;
	// The plan's advertised limit for this metric; null = unlimited or none.
	limit?: number | null;
	// 'counter' only: where `total` stands against the limit.
	status?: 'ok' | 'warning' | 'over_limit' | 'blocked' | null;
	// 'counter' only: the window, e.g. '1d', and when it resets (ISO-8601).
	window?: string | null;
	resetsAt?: string | null;
}

// Wallet balance snapshot. Money fields are digit strings (server bigint →
// string); spendPurchased is a real boolean. granted/purchased/spendPurchased/
// grantedExpiresAt are omitted on a legacy read that predates the bucket split.
export interface IWalletDTO {
	balance: string;
	currency: string;
	precision: number;
	granted?: string;
	purchased?: string;
	spendPurchased?: boolean;
	grantedExpiresAt?: string | null;
}

export interface IWalletResult {
	wallet: IWalletDTO;
}

// One wallet ledger entry. Money fields are digit strings (server bigint →
// string); `balanceAfter` is the running balance, so a history UI can show a
// trustworthy per-row balance without re-deriving it.
export interface IWalletTransactionDTO {
	id: string;
	type: string; // 'purchase' | 'grant' | 'usage' | 'refund' | 'adjustment' | 'expiry'
	amount: string; // signed: positive = credit, negative = debit
	balanceAfter: string;
	currency: string;
	description: string | null;
	providerTxId: string | null;
	metadata: Record<string, unknown>;
	createdAt: string;
}

export interface IWalletTransactionsResult {
	transactions: IWalletTransactionDTO[];
	nextCursor: string | null;
}

export interface IWalletCheckoutInput {
	packId: string;
}

export interface IWalletPurchaseInput {
	packId: string;
	// One per purchase attempt, REUSED on retry: a double-submit or a retry after
	// a `processing` result dedupes to the same charge instead of charging twice.
	idempotencyKey: string;
}

// Outcome of an in-app pack purchase charged to the saved card. `status` is the
// discriminator: 'credited' carries the new balance; 'checkout_required' means
// fall back to createWalletCheckout (no saved card, or the card needs 3-D
// Secure); 'declined' is a hard decline; 'processing' is indeterminate — retry
// with the SAME idempotencyKey (never a fresh hosted checkout, or you'd risk a
// double-charge).
export interface IWalletPurchaseResult {
	status: 'credited' | 'checkout_required' | 'declined' | 'processing';
	balance?: string;
	currency?: string;
	credits?: string;
	duplicate?: boolean;
	reason?: 'no_saved_card' | 'authentication_required';
}

export interface ICancelSubscriptionInput {
	// Default true — keep access until the paid-through date. false ends it now.
	atPeriodEnd?: boolean;
}

// Result of a first-party cancel/reactivate — the subscription's new lifecycle
// state, read straight back without waiting for the provider webhook.
export interface ISubscriptionChangeResult {
	atPeriodEnd: boolean;
	status: string;
	currentPeriodEnd: string | null;
}

// The customer's card on file, for display. Never carries the full number —
// nor the server-side card `fingerprint`, which billing deliberately keeps
// off the wire (it correlates identity across accounts).
export interface IPaymentMethodDTO {
	/**
	 * 'card' (brand/last4/expiry) or 'link' (Stripe Link: no card details —
	 * show `email` instead, e.g. "Link · ana@acme.example"). Absent from servers
	 * that predate it: treat as 'card'.
	 */
	type?: 'card' | 'link';
	brand: string;
	last4: string;
	expMonth: number;
	expYear: number;
	/** The Link account's email, for type 'link'. */
	email?: string | null;
}

export interface IPaymentMethodResult {
	paymentMethod: IPaymentMethodDTO | null;
}

// Begin in-app card entry: the provider SetupIntent client secret the embedded
// card element (Stripe Payment Element) confirms — no hosted-checkout redirect.
export interface ISetupIntentResult {
	clientSecret: string;
}

// Save a card after the client confirms the SetupIntent — the provider payment
// method id the Payment Element produced.
export interface ISavePaymentMethodInput {
	paymentMethodId: string;
}

// One invoice for an in-app history list; `hostedInvoiceUrl`/`invoicePdf` link
// out to the provider. Amounts are digit strings (smallest currency unit).
export interface IInvoiceDTO {
	id: string;
	number: string | null;
	amountDue: string;
	amountPaid: string;
	currency: string;
	status: string;
	created: string;
	dueDate: string | null; // ISO-8601 when the invoice has payment terms; null when paid on charge
	hostedInvoiceUrl: string | null;
	invoicePdf: string | null;
}

export interface IInvoicesResult {
	invoices: IInvoiceDTO[];
	// Opaque cursor for the next (older) page, or null when there is none.
	// Absent from servers that predate invoice pagination.
	nextCursor?: string | null;
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export interface IWorkspaceAddressDTO {
	line1: string;
	line2: string;
	city: string;
	state: string;
	zip: string;
	country: string;
	/** Door / buzzer / gate code; '' when not set (absent from older servers). The unit is line2. */
	accessCode?: string;
}

export interface ITaxRegistrationDTO {
	/** ISO 3166-1, e.g. 'CA'. */
	country: string;
	/** A key of that country's tax-ID rules, e.g. 'GST_HST', 'QST', 'EIN'. */
	type: string;
	/** '' when only the rate is known (the number has not arrived yet). */
	number: string;
	/** ISO 3166-2, e.g. 'CA-QC'; '' when not regional. */
	region: string;
	/** Shown on documents instead of the type, e.g. 'TPS/TVH'. */
	label: string;
	/** The percent charged for this tax (5, 9.975, 13); null when not set (absent from older servers). */
	rate?: number | null;
}

export interface IWorkspaceDTO {
	id: string;
	name: string;
	slug: string;
	type: string;
	description: string;
	motto: string;
	phone: string;
	businessType: string;
	/** The sector / trade, as the app's own key ('plumbing'); '' when not set (absent from older servers). */
	industry?: string;
	address: IWorkspaceAddressDTO;
	/** Registered name, when it differs from the display name. */
	legalName: string;
	email: string;
	website: string;
	logoUrl: string;
	/** GST/HST, QST, PST, EIN, state sales-tax permits… — normalized by country rules. */
	taxRegistrations: ITaxRegistrationDTO[];
	/** The languages the business serves customers in (BCP 47), e.g. ['en-CA', 'fr-CA', 'zh-Hant']. */
	languages: string[];
	/**
	 * @deprecated Not the workspace's billing plan. Set to 'free' when the
	 * workspace is created and never maintained — nothing writes it when the
	 * workspace subscribes, upgrades or cancels. Read the subscription from
	 * @fonderie/billing instead (GET /billing/subscription with the
	 * X-Workspace-ID header; `useSubscription()` in the frontend packages).
	 */
	plan: string;
	ownerId: string;
	isPersonal: boolean;
	isArchived: boolean;
	archivedAt: string;
	// User id that archived the workspace; '' while unarchived.
	archivedBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface IRoleDTO {
	id: string;
	name: string;
	isSystem: boolean;
	active: boolean;
	description: string;
	workspaceId: string;
}

export interface IMemberDTO {
	userId: string;
	workspaceId: string;
	roleId: string;
	roleName: string;
	confirmed: boolean;
	createdAt: string;
	/** Identity, so a member list can be rendered without a second request. */
	email: string;
	firstName: string;
	lastName: string;
	profileImageUrl: string;
	/** Every role this person holds here, earliest first. */
	roles: IMemberRoleDTO[];
	/** The workspace owner. */
	isOwner: boolean;
	/** The owner, or a holder of a manager role — may manage the team. */
	isManager: boolean;
	/** Paused from deleting by the velocity brake, until the owner releases them (releaseBrake). */
	paused?: boolean;
}

export interface IMemberRoleDTO {
	id: string;
	name: string;
	isSystem: boolean;
}

export interface IInvitationDTO {
	id: string;
	workspaceId: string;
	email: string;
	roleId: string;
	token: string;
	status: string;
	expiresAt: string;
	createdAt: string;
	/** Past its expiry: still listed so a manager can resend it, but no longer acceptable. */
	isExpired: boolean;
}

export interface IWorkspaceSettingsDTO {
	locale: string;
	timezone: string;
	currency: string;
	dateFormat: string;
	timeFormat: string;
	/** What goes before a document's number, per kind: { invoice: 'ACME', job: 'ACME-JOB' }; {} when none (absent from older servers). */
	documentPrefixes?: Record<string, string>;
}

export interface IWorkspaceListResult {
	workspaces: IWorkspaceDTO[];
}

export interface IWorkspaceResult {
	workspace: IWorkspaceDTO;
}

export interface IMemberListResult {
	members: IMemberDTO[];
}

export interface IRoleListResult {
	roles: IRoleDTO[];
}

export interface IRoleResult {
	role: IRoleDTO;
}

export interface IInvitationListResult {
	invitations: IInvitationDTO[];
}

export interface IInviteResult {
	invitations: Array<{ invitationId: string; email: string }>;
}

export type PermissionOperation = 'create' | 'read' | 'update' | 'delete';

/** What the signed-in member may do in the current workspace. */
export interface IMyPermissionsResult {
	isOwner: boolean;
	/** The owner or a manager: may run the team (members, invitations, roles, settings). */
	isManager: boolean;
	/** Holds the super role: every resource, every operation. */
	isSuper: boolean;
	/** Per resource, per operation. A missing resource or operation is not allowed. */
	permissions: Record<string, Record<PermissionOperation, boolean>>;
}

export interface IPermissionCatalogEntryDTO {
	key: string;
	operations: PermissionOperation[];
	label: string;
	description: string;
}

export interface IPermissionCatalogResult {
	catalog: IPermissionCatalogEntryDTO[];
	/** False when the app declared no catalog (the list is then empty). */
	declared: boolean;
}

export interface IRoleDeleteResult {
	/** People who held the role. */
	membersAffected: number;
	/** Of those, the ones it was the only role of — now on the default role. */
	movedToDefaultRole: number;
}

export interface IInvitationResult {
	invitation: IInvitationDTO;
}

export type IAcceptInvitationInput = { token: string } | { pin: string };

export interface IAcceptInvitationResult {
	workspaceId: string;
}

// ── Workspace contacts & locations ───────────────────────────────────────────
// The primary email, the primary phone and the head office's address are what
// IWorkspaceDTO.email / phone / address show.

export interface IWorkspaceEmailDTO {
	id: string;
	/** Lower-cased. */
	email: string;
	label: string;
	isPrimary: boolean;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspacePhoneDTO {
	id: string;
	/** E.164, e.g. '+15145550100'. */
	phone: string;
	/** Digits; '' when none. */
	extension: string;
	label: string;
	isPrimary: boolean;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface IWorkspaceLocationDTO {
	id: string;
	name: string;
	address: IWorkspaceAddressDTO;
	/** ISO 3166-2, e.g. 'CA-QC' — whose sales taxes apply here; '' when unknown. */
	taxRegion: string;
	latitude: number | null;
	longitude: number | null;
	/** E.164; '' when none. */
	phone: string;
	email: string;
	isHeadOffice: boolean;
	position: number;
	isArchived: boolean;
	archivedAt: string;
	archivedBy: string;
	createdAt: string;
	updatedAt: string;
}

/** GET /workspaces/contacts. */
export interface IWorkspaceContactsResult {
	/** The primary first. */
	emails: IWorkspaceEmailDTO[];
	/** The primary first. */
	phones: IWorkspacePhoneDTO[];
	/** The head office first; archived ones last (restorable). */
	locations: IWorkspaceLocationDTO[];
}

export interface IWorkspaceEmailResult {
	email: IWorkspaceEmailDTO;
}

export interface IWorkspacePhoneResult {
	phone: IWorkspacePhoneDTO;
}

export interface IWorkspaceLocationResult {
	location: IWorkspaceLocationDTO;
}

export interface IWorkspaceSettingsResult {
	settings: IWorkspaceSettingsDTO;
}

// ── Courier admin (template management) ─────────────────────────────────────
// Admin-token authenticated, not user-session authenticated — see
// CourierAdminClient. Result shapes here are the raw resource, not wrapped
// in a named key, matching @fonderie/courier's admin route handlers.

// Every email the app can send — saved or built-in only — with the languages it
// exists in. GET /admin/template-catalog.
export interface ITemplateCatalog {
	/** The system locale: the default (untagged) version is written in it. */
	defaultLocale: string;
	/** Per market or language, where its content comes from, before the system locale. */
	fallbacks: Record<string, string[]>;
	emails: ITemplateCatalogEntry[];
}

export interface ITemplateCatalogEntry {
	type: string;
	/** Built-in email: its default version can be edited and rolled back, never deleted. */
	system: boolean;
	/** What Fonderie ships: the English default, and the other languages. */
	builtIn: { default: boolean; languages: string[] };
	/** The app's saved versions (locale null = the default version). */
	versions: Array<{ locale: string | null; active: boolean; version: number; updatedAt: string }>;
}

// Fonderie's own copy of an email in one language.
export interface IBuiltInTemplate {
	type: string;
	/** The language key it matched ('fr' for fr-CA), or the system locale for the English. */
	locale: string;
	subject: string | null;
	html: string | null;
	text: string;
}

// Who receives what: the version a send in `requested` would use.
export interface ITemplateResolution {
	requested: string;
	/** Locales tried before the system locale, in order. */
	chain: string[];
	defaultLocale: string;
	/** The version used: a saved tag, a built-in language, or the system locale. */
	sent: string;
	source: 'saved' | 'built-in';
}

export interface ITemplateEntry {
	// A built-in email's default-locale row: edit and roll back, never delete.
	// Present on list results from @fonderie/courier ≥ the system-template release.
	system?: boolean;
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

export interface ITemplateRevision {
	type: string;
	locale: string | null;
	subject: string | null;
	html: string | null;
	text: string;
	version: number;
	actor: string | null;
	createdAt: string;
}

// ── Admin (the operator's surface) ───────────────────────────────────────────
// Admin-token authenticated — see AdminClient. Shapes mirror @fonderie/admin's
// pages; the client owns its copies, like every other section here.

// A machine-readable cause, in the shape of Google's AIP-193 ErrorInfo:
// `reason` (UPPER_SNAKE, stable) unique within `domain` (the brick), with the
// raw values in `metadata`. `message` next to it is the English fallback.
// localizeReason() renders it in the console's language.
export interface IAdminReason {
	message: string;
	reason?: string;
	domain?: string;
	metadata?: Record<string, string | number>;
}

export interface IAdminReadinessProblem extends IAdminReason {
	module: string;
	severity: 'error' | 'warning';
}

export interface IAdminReadiness {
	ok: boolean;
	problems: IAdminReadinessProblem[];
}

export interface IAdminModuleEntry {
	name: string;
	version: string | null;
	readiness: IAdminReadiness;
	describesAdmin: boolean;
}

export interface IAdminRouteEntry {
	method: string;
	path: string;
	module?: string;
}

export interface IAdminManifest {
	generatedAt: string;
	env: string;
	// `host` is null when the surface answers on any hostname.
	admin: { version: string; log: boolean; host: string[] | null };
	modules: IAdminModuleEntry[];
	readiness: IAdminReadiness;
	routes: IAdminRouteEntry[];
}

export interface IAdminFinding extends IAdminReason {
	severity: 'error' | 'advice';
}

export interface IAdminCheckResult {
	name: string;
	module: string;
	ok: boolean;
	/** English, one per finding — what logs and older consoles read. */
	findings: string[];
	/** The same findings in order, with reason and resolved severity. Servers before @fonderie/admin 1.7 omit it. */
	details?: IAdminFinding[];
	skipped?: string;
	skippedDetail?: IAdminFinding;
	durationMs: number;
}

export interface IAdminDoctorReport {
	generatedAt: string;
	ok: boolean;
	checks: IAdminCheckResult[];
}

export interface IAdminAttentionItem extends IAdminReason {
	source: string;
	severity: 'error' | 'advice';
}

export interface IAdminAttention {
	generatedAt: string;
	ok: boolean;
	items: IAdminAttentionItem[];
}

export interface IAdminEnvironmentReport {
	generatedAt: string;
	readiness: IAdminReadiness;
	modules: Array<{ name: string; problems: IAdminReadinessProblem[] }>;
	env: Array<{ name: string; set: boolean }>;
}

export type AdminRouteGuard = 'admin' | 'probe' | 'app';

export interface IAdminRoutesReport {
	generatedAt: string;
	routes: Array<IAdminRouteEntry & { guard: AdminRouteGuard }>;
}

export type AdminScope = 'read' | 'write' | 'secrets';

// An issued scoped token — never its hash or plaintext.
export interface IAdminTokenRecord {
	id: string;
	name: string;
	scopes: AdminScope[];
	createdBy: string;
	createdAt: string;
	expiresAt: string | null;
	revokedAt: string | null;
	lastUsedAt: string | null;
}

export interface IAdminTokensReport {
	generatedAt: string;
	admin: { ok: boolean; problems: IAdminReadinessProblem[] };
	legacy: Array<{ module: string; set: boolean }>;
	// null when the deployment gave AdminModule no store (issuing is off).
	issued: IAdminTokenRecord[] | null;
}

export interface IAdminIssueTokenInput {
	name: string;
	scopes: AdminScope[];
	expiresInDays?: number;
}

// The plaintext is returned once, at issue, and never again.
export interface IAdminIssuedToken extends IAdminTokenRecord {
	token: string;
}

// ── operators: people who sign in to the admin console ──────────────────

// What the API ever says about an operator — never a hash, secret or code.
export interface IAdminOperator {
	id: string;
	email: string;
	name: string | null;
	scopes: AdminScope[];
	// false until they have scanned the QR code and confirmed a code.
	enrolled: boolean;
	backupCodesLeft: number;
	locked: boolean;
	createdBy: string;
	createdAt: string;
	lastLoginAt: string | null;
	disabledAt: string | null;
}

// A pending single-use link: an invite, or a recovery for a locked-out operator.
export interface IAdminOperatorLink {
	id: string;
	kind: 'invite' | 'recovery';
	email: string;
	scopes: AdminScope[];
	createdBy: string;
	createdAt: string;
	expiresAt: string;
}

export interface IAdminOperatorsReport {
	operators: IAdminOperator[];
	links: IAdminOperatorLink[];
}

// Returned once: the link to hand to the person. `url` points at the console
// with the token in the hash, so it never reaches a server log.
export interface IAdminCreatedLink {
	id: string;
	email: string;
	scopes?: AdminScope[];
	expiresAt: string;
	token: string;
	url: string;
}

export type AdminSessionState = 'signed-out' | 'needs-2fa' | 'needs-enrollment' | 'signed-in';

export interface IAdminSession {
	state: AdminSessionState;
	operator: IAdminOperator | null;
	// true only while no operator exists yet: the root token can claim the console.
	claimable?: boolean;
	stepUpFresh?: boolean;
	// Present once, right after enrollment. Show them; they are never shown again.
	backupCodes?: string[];
	// After signing in with a backup code: how many remain.
	backupCodesLeft?: number;
}

export interface IAdminEnrollment {
	secret: string;
	// otpauth:// — render as a QR code.
	uri: string;
	account: string;
	issuer: string;
}

export type IAdminSecondFactor = { code: string } | { backupCode: string };

export interface IAdminLogEntry {
	id: string;
	at: string;
	actor: string;
	method: string;
	path: string;
	route: string;
	module: string;
	status: number;
	durationMs: number;
	requestId: string | null;
	clientIp: string | null;
}

export interface IAdminLogPage {
	entries: IAdminLogEntry[];
	next: string | null;
}

// The operator's view of a user (@fonderie/auth's described admin routes):
// the app's own DTO plus what support asks about. Never a hash or MFA secret.
export interface IAdminUserDTO extends IUserDTO {
	deletedAt: string | null;
	/** Set while the account awaits deletion (archived): when, how, and whether it is held. */
	deletion?: IAdminDeletionDTO | null;
}

/** An archived account's deletion, as the operator sees it. */
export interface IAdminDeletionDTO {
	requestedAt: string;
	/** When the schedule erases it — unless it is held. */
	deleteOn: string;
	/** The channel the person confirmed with; the reminder goes the same way. */
	channel: string | null;
	remindedAt: string | null;
	/** A legal hold stops the schedule until an operator lifts it. */
	hold: { at: string; reason: string | null } | null;
}

/** An erasure receipt — no personal data: identifiers as keyed hashes only. */
export interface IAdminErasureDTO {
	id: string;
	userId: string;
	emailHash: string | null;
	phoneHash: string | null;
	requestedAt: string | null;
	remindedAt: string | null;
	erasedAt: string;
	/** 'schedule' on its date, 'operator' for an "erase now". */
	initiatedBy: string;
	outcomes: Array<{ brick: string; erased: number; kept?: string }>;
}

export interface IAdminErasurePageResult {
	erasures: IAdminErasureDTO[];
	nextCursor: string | null;
}

export interface IAdminErasureExport {
	generatedAt: string;
	/** More receipts exist than one export carries. */
	truncated: boolean;
	erasures: IAdminErasureDTO[];
}

// The operator's money reads (@fonderie/billing's described admin routes).
export interface IAdminCatalog {
	// config.plans as declared; bigint wallet amounts arrive as strings.
	configured: unknown[];
	stored: IPlanDTO[];
}

export interface IAdminSubscriptionDTO {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	plan: string;
	interval: string;
	status: string;
	providerCustomerId: string | null;
	providerSubscriptionId: string | null;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	trialEndsAt: string | null;
	createdAt: string;
}

export interface IAdminWalletDTO extends IWalletDTO {
	version: number;
	updatedAt: string | null;
}

export interface IAdminSubscriptionPage {
	subscriptions: IAdminSubscriptionDTO[];
	nextCursor: string | null;
}

export interface IAdminWalletLedgerPage {
	currency: string;
	entries: IWalletTransactionDTO[];
	nextCursor: string | null;
}

export interface IAdminPlanInput {
	name?: string;
	description?: string | null;
	tier?: number;
	seats?: number | null;
	trialDays?: number;
	monthlyAmount?: number | null;
	monthlyPriceId?: string | null;
	yearlyAmount?: number | null;
	yearlyPriceId?: string | null;
	features?: unknown;
	metadata?: unknown;
}

export interface IAdminGrantInput {
	subscriberType: SubscriberType;
	subscriberId: string;
	// Minor units as a digit string (or a number below 2^53).
	amount: string | number;
	currency?: string;
	description?: string;
	idempotencyKey: string;
}

// ── Config admin (feature flags / remote config + secrets) ──────────────────
// Admin-token authenticated, not user-session authenticated — see
// ConfigAdminClient. Result shapes here are the raw resource, matching
// @fonderie/config's admin route handlers.

export interface IConfigEntry {
	key: string;
	value: unknown;
	environment: string;
	description: string | null;
	active: boolean;
	version: number;
	updatedBy: string | null;
	updatedAt: string;
}

export interface IConfigRevision {
	key: string;
	environment: string;
	value: unknown;
	version: number;
	actor: string | null;
	createdAt: string;
}

// Deliberately has no `value` — admin list/get never return a secret's
// plaintext, only the explicit reveal path does.
export interface ISecretEntry {
	key: string;
	environment: string;
	description: string | null;
	active: boolean;
	version: number;
	updatedBy: string | null;
	updatedAt: string;
}

export interface ISecretRevision {
	key: string;
	environment: string;
	version: number;
	actor: string | null;
	createdAt: string;
}

export interface IRevealSecretResult {
	value: string;
}

// ── Audit ────────────────────────────────────────────────────────────────────
// Session-authenticated (shares FonderieClient's TokenStore, scoped via
// setWorkspaceId like billing/workspaces) — unlike courier-admin/config-admin,
// which use a standalone admin token. Read-only: @fonderie/audit has one route.

export interface IAuditEventDTO {
	id: string;
	type: string;
	actorId: string | null;
	requestId: string | null;
	payload: Record<string, unknown>;
	createdAt: string;
}

export interface IAuditPageResult {
	events: IAuditEventDTO[];
	nextCursor: string | null;
}

// ── Login activity (auth security surfaces) ──────────────────────────────────
// Session-authenticated; the caller's own history + sessions (shares the
// AuthClient token). Login history is append-only; sessions are the live list.

/** Where an auth event (login attempt, registration, session) came from. Present only when the server configures a
 * location resolver; every field is optional. Country is reliable; region and
 * city are approximate; network fields appear only with an IP-intelligence
 * provider. */
export interface IRequestLocationDTO {
	country?: string; // ISO-3166-1 alpha-2
	countryName?: string;
	subdivision?: string; // ISO-3166-2 region part
	subdivisionName?: string;
	city?: string;
	postalCode?: string; // ZIP / postal code, approximate — not shown by describeLocation
	continent?: string;
	timeZone?: string;
	latitude?: number;
	longitude?: number;
	accuracyRadius?: number; // km — how approximate the point is
	geonameId?: number; // stable, language-neutral place key (GeoNames)
	isp?: string;
	org?: string;
	asn?: string;
	mobile?: boolean;
	proxy?: boolean;
	hosting?: boolean;
}

/**
 * One short line for a login location: "Mountain View, CA, US" — most specific first,
 * skipping what is unknown. Pass a country-name formatter to localise the
 * country (e.g. Intl.DisplayNames). null when nothing is known.
 */
export function describeLocation(
	loc: IRequestLocationDTO | null | undefined,
	countryName?: (code: string) => string | undefined,
): string | null {
	if (!loc) return null;
	const country = loc.country
		? (countryName?.(loc.country) ?? loc.country)
		: (loc.countryName ?? undefined);
	const parts = [loc.city, loc.subdivision ?? loc.subdivisionName, country].filter(
		(p): p is string => typeof p === 'string' && p.length > 0,
	);
	return parts.length > 0 ? parts.join(', ') : null;
}

export interface ILoginEventDTO {
	id: string;
	method: string;
	outcome: string;
	failureReason: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	/** null when the server has no location resolver, or it knew nothing. */
	location: IRequestLocationDTO | null;
	createdAt: string;
}

export interface IAdminUserPageResult {
	users: IAdminUserDTO[];
	nextCursor: string | null;
}

export interface ILoginHistoryPageResult {
	events: ILoginEventDTO[];
	nextCursor: string | null;
}

export interface ISessionDTO {
	id: string;
	current: boolean;
	ipAddress: string | null;
	userAgent: string | null;
	/** Where the session was opened from; null without a server-side resolver. */
	location: IRequestLocationDTO | null;
	createdAt: string;
	expiresAt: string;
}

export interface ISessionsResult {
	sessions: ISessionDTO[];
}

// ── Media ────────────────────────────────────────────────────────────────────
// Session-authenticated image storage (avatars, logos). `url` is the
// monomorphic, backend-relative /media/:id path; call client.media.assetUrl(id)
// for an absolute `<img src>`.

export interface IMediaAssetDTO {
	id: string;
	url: string;
	contentType: string;
	byteSize: number;
	ownerType: string;
	ownerId: string;
	purpose: string;
	createdAt: string;
}

export interface IMediaAssetResult {
	asset: IMediaAssetDTO;
}

// ── Webhooks ─────────────────────────────────────────────────────────────────
// Session-authenticated (shares FonderieClient's TokenStore, scoped via
// setWorkspaceId like billing/workspaces/audit).

export interface IWebhookEndpointDTO {
	id: string;
	url: string;
	events: string[];
	enabled: boolean;
	createdAt: string;
}

// The signing secret is only ever returned here, at creation — every other
// read masks it, matching @fonderie/webhooks' own toEndpointDTO/toEndpointCreatedDTO split.
export interface IWebhookEndpointCreatedDTO extends IWebhookEndpointDTO {
	secret: string;
}

export interface IWebhookDeliveryDTO {
	id: string;
	eventId: string;
	eventType: string;
	status: string;
	attempts: number;
	// The event body that was delivered — what the endpoint received.
	payload: Record<string, unknown>;
	responseStatus: number | null;
	// The receiving endpoint's response body (useful when debugging failures).
	responseBody: string | null;
	// When the next retry is due; null once delivered or exhausted.
	nextAttemptAt: string | null;
	deliveredAt: string | null;
	createdAt: string;
}

export interface IWebhookEndpointListResult {
	endpoints: IWebhookEndpointDTO[];
}

export interface IWebhookDeliveryListResult {
	deliveries: IWebhookDeliveryDTO[];
}

export interface ITestWebhookResult {
	status: number | null;
	ok: boolean;
	error?: string;
}

// ── Customers ────────────────────────────────────────────────────────────────
// Session-authenticated (shares FonderieClient's TokenStore, scoped via
// setWorkspaceId like billing/workspaces/audit/webhooks).

export type CustomerType = 'individual' | 'business';
export type CustomerSex = 'UNKNOWN' | 'MALE' | 'FEMALE';
export type CustomerLabelType = 'phone' | 'email' | 'address';

export interface ICustomerDTO {
	id: string;
	type: string;
	sex: CustomerSex;
	firstName: string;
	lastName: string;
	companyName: string;
	avatarUrl: string;
	/** Preferred language (BCP 47), e.g. 'fr-CA', 'zh-Hant'. Defaults to the business's. */
	locale: string;
	/**
	 * The name to show, in the order the customer's language writes it: family
	 * name first for Chinese, Japanese, Korean ('王小明'); given name first
	 * otherwise. A business shows its company name.
	 */
	displayName: string;
	referenceCode: string;
	referralCode: string;
	referredBy: string | null;
	blacklisted: { status: boolean; reason: string | null };
	/** Archived: hidden from lists and pickers, kept on documents. */
	archived: { status: boolean; at: string | null };
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface ICustomerEmailDTO {
	id: string;
	email: string;
	label: string;
	// Id of the shared label row (see listLabels) — null when unlabeled.
	labelId: string | null;
	isPrimary: boolean;
	createdAt: string;
}

export interface ICustomerPhoneDTO {
	id: string;
	phone: string;
	label: string;
	// Id of the shared label row (see listLabels) — null when unlabeled.
	labelId: string | null;
	isPrimary: boolean;
	createdAt: string;
}

export interface IAddressDTO {
	countryIso: string;
	subdivision1Iso: string;
	subdivision2Iso: string;
	zipPostalCode: string;
	unit: string;
	line1: string;
	line2: string;
}

export interface ICustomerAddressDTO {
	id: string;
	label: string;
	// Id of the shared label row (see listLabels) — null when unlabeled.
	labelId: string | null;
	isPrimary: boolean;
	address: IAddressDTO;
}

export interface ICustomerNoteDTO {
	id: string;
	authorId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface ICustomerRelationshipDTO {
	id: string;
	relatedId: string;
	relationship: string;
	isPrimary: boolean;
	createdAt: string;
}

// Flat merge: relationship metadata + related customer fields spread at the
// same level. `id` is the relationship record id; `customerId` is the
// related customer's id — matches @fonderie/customers' own flattening.
export type ICustomerRelationshipExpandedDTO = Omit<ICustomerShallowDTO, 'id'> & {
	/** The RELATED customer's id — same name as in ICustomerRelationshipDTO. */
	relatedId: string;
	/** The relationship record's id. */
	relationshipId: string;
	/** @deprecated The relationship record's id, not a customer's — read `relationshipId`. */
	id: string;
	/** @deprecated The related customer's id — read `relatedId`. */
	customerId: string;
	relationship: string;
	isPrimary: boolean;
	// When the relationship itself was created. The spread customer fields
	// include the related CUSTOMER's createdAt/updatedAt — don't sort
	// relationships by those.
	relationshipCreatedAt: string;
};

export type ICustomerRelationshipExpandedD2DTO = ICustomerRelationshipExpandedDTO & {
	relationships: ICustomerRelationshipExpandedDTO[];
};

export interface ICustomerShallowDTO extends ICustomerDTO {
	emails: ICustomerEmailDTO[];
	phones: ICustomerPhoneDTO[];
	addresses: ICustomerAddressDTO[];
	notes: ICustomerNoteDTO[];
	tags: string[];
}

export interface ICustomerDetailDTO extends ICustomerDTO {
	emails: ICustomerEmailDTO[];
	phones: ICustomerPhoneDTO[];
	addresses: ICustomerAddressDTO[];
	notes: ICustomerNoteDTO[];
	relationships: ICustomerRelationshipExpandedDTO[];
	tags: string[];
}

// depth=1 (default via getCustomer) — one level of relationship expansion.
// depth=2 (getCustomer(id, { depth: 2 })) — relationships carry their own
// relationships array one level deeper. Matches @fonderie/customers' D2 DTOs.
export interface ICustomerDetailD2DTO extends Omit<ICustomerDetailDTO, 'relationships'> {
	relationships: ICustomerRelationshipExpandedD2DTO[];
}

export interface ICustomerLabelDTO {
	id: string;
	type: CustomerLabelType;
	value: string;
	createdAt: string;
}

export interface ICustomerListResult {
	customers: ICustomerDTO[];
	// Total matching rows regardless of limit/offset — for pagination.
	total: number;
}

export interface ICustomerResult {
	customer: ICustomerDTO;
}

export interface ICustomerEmailListResult {
	emails: ICustomerEmailDTO[];
}

export interface ICustomerEmailResult {
	email: ICustomerEmailDTO;
}

export interface ICustomerPhoneListResult {
	phones: ICustomerPhoneDTO[];
}

export interface ICustomerPhoneResult {
	phone: ICustomerPhoneDTO;
}

export interface ICustomerAddressListResult {
	addresses: ICustomerAddressDTO[];
}

export interface ICustomerAddressResult {
	address: ICustomerAddressDTO;
}

export interface ICustomerNoteListResult {
	notes: ICustomerNoteDTO[];
}

export interface ICustomerNoteResult {
	note: ICustomerNoteDTO;
}

export interface ICustomerTagListResult {
	tags: string[];
}

export interface ICustomerRelationshipListResult {
	relationships: ICustomerRelationshipDTO[];
}

export interface ICustomerRelationshipResult {
	relationship: ICustomerRelationshipDTO;
}

export interface ICustomerLabelListResult {
	labels: ICustomerLabelDTO[];
}

// ---- admin: migrations ----------------------------------------------------

export type MigrationImpact = 'additive' | 'destructive';

export interface IAdminPendingMigration {
	file: string;
	impact: MigrationImpact;
	// The statements that earned a 'destructive' label, as written.
	destructive: string[];
}

export interface IAdminMigrationModule {
	name: string;
	pending: IAdminPendingMigration[];
	// The first EARLIER module that is behind, or null. Migration order is the
	// app's and sets depend on each other across it.
	blockedBy: string | null;
	// Whether the panel will apply this one: something to do, nothing in front
	// of it, and nothing in it that deletes data.
	appliable: boolean;
}

export interface IAdminMigrationsReport {
	// False when the database has no fonderie_migrations rows — a first
	// install, where "destructive" has nothing to destroy.
	everApplied: boolean;
	modules: IAdminMigrationModule[];
}

// ── The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3) ─────────────────
// Deleted records, restorable until `purgeAt`. Only the workspace owner can
// remove one from the bin early.

export interface IDeletedWebhookEndpointDTO {
	id: string;
	url: string;
	events: string[];
	deletedBy: string | null;
	deletedAt: string;
	purgeAt: string;
}

export interface IDeletedCustomerDTO {
	id: string;
	firstName: string | null;
	lastName: string | null;
	companyName: string | null;
	referenceCode: string | null;
	deletedBy: string | null;
	deletedAt: string;
	purgeAt: string;
}

export interface IDeletedRoleDTO {
	id: string;
	name: string;
	description: string | null;
	/** How many people held it when it was deleted. */
	holders: number;
	deletedBy: string | null;
	deletedAt: string;
	purgeAt: string;
}

export interface IRestoredRoleResult {
	role: IRoleDTO | null;
	/** Former holders still in the team who have it again. */
	reassigned: number;
}

// ── Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4) ──────────────────────
// A big move (hand a team over, end a plan at once, add a webhook) answers
// 403 STEP_UP_REQUIRED until the person proves it's still them.

export type StepUpMethod = 'password' | 'mfa' | 'email' | 'sms';

export interface IStepUpMethodsResult {
	/** Strongest first; with two-factor on, only 'mfa'. */
	methods: StepUpMethod[];
}

export interface IStepUpProof {
	password?: string;
	mfaCode?: string;
	/** The 6-digit code from requestStepUpCode. */
	code?: string;
}

export interface IStepUpResult {
	stepUpToken: string;
	expiresAt: string;
	method: StepUpMethod;
}

/** An open offer of a workspace to a member (Phase 4): it moves when they accept. */
export interface IOwnershipOfferDTO {
	workspaceId: string;
	fromUserId: string;
	toUserId: string;
	createdAt: string;
	/** When it lapses (7 days). */
	expiresAt: string;
}

