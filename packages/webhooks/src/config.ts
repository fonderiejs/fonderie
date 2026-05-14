export interface IWebhooksConfig {
	maxAttempts?:   number;    // default 3
	retryDelays?:   number[];  // ms between retries, default [60_000, 300_000, 1_800_000]
	retryInterval?: number;    // ms between retry polls, default 60_000
}
