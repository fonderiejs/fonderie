import type { IWorkspacesConfig } from '@fonderie/workspaces';

export interface IWebhooksConfig {
	maxAttempts?: number; // default 3
	retryDelays?: number[]; // ms between retries, default [60_000, 300_000, 1_800_000]
	retryInterval?: number; // ms between retry polls, default 60_000
	// Who may manage endpoints — same meaning as in @fonderie/workspaces.
	// Default 'owner-or-admin'; 'any-member' lets every member manage them.
	management?: IWorkspacesConfig['management'];
	// Creating an endpoint (or pointing one at a new URL) asks for a fresh proof
	// it's the person (POST /auth/step-up, @fonderie/auth 7.27+). Default true.
	stepUp?: boolean;
	// System-role names that count as managers (default ['ADMIN']).
	managerRoles?: IWorkspacesConfig['managerRoles'];
}
