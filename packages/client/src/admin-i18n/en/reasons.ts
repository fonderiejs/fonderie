// English — canonical. The sentence behind every `domain` + `reason` a Fonderie
// brick reports to the console (readiness problems, doctor findings, skip
// reasons). Keyed exactly as emitted: reasons.<domain>.<REASON>. `{name}`
// interpolates the finding's metadata. `values` translates enum-like metadata
// values (UPPER_SNAKE), so no English leaks through a parameter.
//
// Adding a reason in a brick without adding it here fails `check:reasons`.
const reasons = {
	admin: {
		CHECK_TIMED_OUT: 'Timed out after {ms} ms.',
		CHECK_THREW: 'The check crashed: {detail}',
		CHECK_FAILED: 'The check failed without saying why.',
		MIGRATIONS_PENDING: '{module}: {count} migration(s) not applied — {files}',
		OPERATOR_KEY_INVALID: 'operatorKey must be 64 hex characters (openssl rand -hex 32).',
	},
	auth: {
		JWT_SECRET_TOO_SHORT: 'jwtSecret must be at least {min} characters (it has {got}).',
		JWT_SECRET_PLACEHOLDER: 'jwtSecret looks like a placeholder or development value.',
		JWT_PREVIOUS_SECRET_WEAK: 'jwtPreviousSecrets[{index}] is too short or a placeholder — it still verifies tokens.',
		INSECURE_COOKIES:
			'secureCookies is off — sign-in cookies may travel over plain HTTP in production.',
		GOOGLE_INCOMPLETE:
			'Google sign-in is configured but incomplete: set the client ID, plus the client secret and redirect URI (web sign-in) and/or the native client IDs (app sign-in).',
		GOOGLE_SECRET_PLACEHOLDER:
			'The Google client secret looks like a placeholder or development value.',
		APPLE_INCOMPLETE:
			'Sign in with Apple is configured but the client ID, team ID, key ID, private key or redirect URI is missing.',
		APPLE_KEY_NOT_PEM:
			'The Apple private key is not a PEM .p8 key (expected -----BEGIN PRIVATE KEY-----).',
		GOOGLE_NATIVE_IDS_INVALID:
			'Google native client IDs must be exact client IDs — empty or wildcard entries would accept tokens issued to other apps.',
		APPLE_NATIVE_IDS_INVALID:
			'Apple native client IDs must be exact bundle IDs — empty or wildcard entries would accept tokens issued to other apps.',
		MFA_KEY_MISSING:
			'Two-factor sign-in is on without mfaSecretKey — authenticator secrets are stored unencrypted. Set a 32-byte key (openssl rand -hex 32).',
		MFA_KEY_INVALID: 'mfaSecretKey must be 64 hex characters (openssl rand -hex 32).',
	},
	billing: {
		PRICE_CHECK_FAILED: 'The price check could not run: {detail}',
		PRICE_NOT_FOUND: '{ref}: price {price} does not exist at the payment provider.',
		PRICE_INACTIVE: '{ref}: price {price} is inactive at the payment provider.',
		PRICE_MISMATCH:
			'{ref}: the catalog says {declared}, the provider charges {actual}. Saved-card and auto-recharge purchases use the catalog; hosted checkout uses the provider.',
		WEBHOOK_CHECK_FAILED: 'The webhook check could not run: {detail}',
		WEBHOOK_NOT_REGISTERED:
			'{url} is not registered — none of the events handled there will ever arrive.',
		WEBHOOK_DISABLED: '{url} is disabled at the provider — it sends nothing.',
		WEBHOOK_EVENTS_MISSING: '{url} is not subscribed to {events} — those handlers can never run.',
		WEBHOOK_API_VERSION:
			'{url} sends payloads as {endpointVersion}; this app reads {clientVersion}. Invoice payloads are read tolerantly, so nothing is lost, but the drift should be closed: recreate the endpoint on {clientVersion} (new signing secret).',
		DRIFT_CHECK_FAILED: 'The subscription check could not run: {detail}',
		SUBSCRIPTION_MISSING_AT_PROVIDER:
			'{subscriber} ({subscription}): marked {status} here, but the provider has no such subscription — {impact}.',
		SUBSCRIPTION_FIELDS_DIFFER:
			'{subscriber} ({subscription}): {fields} differ — here {ours}, at the provider {theirs} — {impact}.',
		DRIFT_TRUNCATED: 'Only part of the subscriptions were compared: {note}',
		NOTIFICATIONS_UNWIRED:
			'Payments are enabled but customers cannot be notified — pass an event bus and resolveRecipient to BillingModule so receipts, refunds and failed-payment notices are sent.',
		AUTO_RECHARGE_UNSUPPORTED:
			'Plan {plan} enables automatic top-up, but provider {provider} cannot charge a saved card — it will never happen.',
		AUTO_RECHARGE_UNKNOWN_PACK:
			'Plan {plan} tops up with credit pack {pack}, which does not exist — add it to the catalog.',
		ALLOWANCE_WITHOUT_WALLET:
			'Plan {plan} grants a balance allowance, but the wallet is off — the allowance does nothing.',
		NEGATIVE_ROLLOVER_CAP:
			'Plan {plan} has a negative rollover cap ({cap}) — use 0 or more, none, or full.',
		WEBHOOK_SECRET_MISSING:
			"The subscription webhook secret is not set — Stripe's calls to /billing/webhook fail and renewals and cancellations are never applied.",
		WALLET_WEBHOOK_SECRET_MISSING:
			"The wallet webhook secret is not set — Stripe's calls to /billing/webhook/payment fail and credit-pack purchases are never credited.",
		PROVIDER_CANNOT_BE_ASKED: 'The payment provider cannot answer this check.',
		PUBLIC_URL_NOT_SET: 'The public API URL is not set, so webhook endpoints cannot be checked.',
	},
	config: {
		NO_SECRET_ENCRYPTOR:
			'No secret encryption key — the secrets page refuses every request rather than store plaintext. Set CONFIG_SECRET_KEY.',
	},
	core: {
		ADMIN_TOKEN_TOO_SHORT: 'The admin token must be at least {min} characters (it has {got}).',
		ADMIN_TOKEN_PLACEHOLDER: 'The admin token looks like a placeholder or development value.',
	},
	courier: {
		CHANNEL_WITHOUT_PROVIDER:
			'{count} message type(s) are sent by {channel}, but no {channel} provider is set up — they are silently dropped: {types}.',
		TEMPLATES_UNROUTED:
			'{count} message type(s) have a template but no channel, so they are never delivered: {types}.',
		SENDER_DNS_CHECK_FAILED: 'The sender DNS check could not run: {detail}',
		SPF_MULTIPLE: '{count} SPF records on {domain} — receivers treat that as no SPF at all.',
		DMARC_MISSING:
			'No DMARC record for {domain} — receivers apply their own judgement to your mail.',
		DMARC_MONITORING_ONLY:
			'DMARC on {domain} is monitoring only (p=none), so forged mail is still delivered. Move to quarantine or reject once reports look clean.',
		DKIM_KEY_MISSING:
			'No DKIM key at {host} — mail signed with selector {selector} cannot be verified.',
		SPF_ABSENT_DKIM_ALIGNS:
			'No SPF record on {domain}, which is expected when your provider owns the return path; DMARC passes on DKIM.',
		SPF_AND_DKIM_MISSING:
			'No SPF record on {domain} and no DKIM key — DMARC cannot pass, so mail is unauthenticated.',
		SPF_ABSENT_DKIM_UNKNOWN:
			'No SPF record on {domain}. Fine if your provider owns the return path and publishes DKIM — list the DKIM selectors so this can be confirmed.',
	},
	events: {
		NO_INTEGRITY_KEY: 'No integrity key — the event log is not tamper-evident.',
		WEAK_INTEGRITY_KEY:
			'The integrity key is too short or looks like a placeholder — event signatures could be forged. Generate one with openssl rand -hex 32.',
		TRANSPORT_NOT_STARTED: 'The event transport has not started yet.',
		EVENT_TAMPERED: 'Event {event} no longer matches its signature — it was changed.',
		EVENTS_UNSIGNED: '{count} event(s) predate signing and cannot be verified.',
		EVENT_DEAD: '{type} ({consumer}) failed every retry and will never be delivered: {error}',
		BACKLOG_STALE: '{consumer}: {waiting} waiting, the oldest for {minutes} min.',
	},
	values: {
		impact: {
			UNDER_GRANTING: 'the customer is missing access they paid for',
			OVER_GRANTING: 'access is granted without payment',
			METADATA: 'details only, no effect on access',
		},
	},
};
export default reasons;
