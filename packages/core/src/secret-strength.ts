// One weak/placeholder-secret denylist + minimum length, so every module that
// guards a surface with a bootstrap secret (auth jwtSecret, module adminTokens)
// enforces the SAME bar. Call sites keep their own POLICY (required vs optional,
// which field name to name in the message) — only the rule is shared.
export const MIN_SECRET_LENGTH = 32;
export const PLACEHOLDER_SECRET =
	/dev-secret|test-secret|changeme|change-me|your[-_]secret|placeholder|example|insecure|admin-token|min-32-chars/i;

// The single classification. null = strong enough. Each caller formats its own
// IReadinessProblem (naming its field) from this verdict.
export function secretStrengthProblem(secret: string): 'too-short' | 'placeholder' | null {
	if (secret.length < MIN_SECRET_LENGTH) return 'too-short';
	if (PLACEHOLDER_SECRET.test(secret)) return 'placeholder';
	return null;
}
