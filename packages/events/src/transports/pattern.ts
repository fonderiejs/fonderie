// Glob matching for event topic patterns.
// '*' alone matches everything. Otherwise '*' is a wildcard for any
// characters including dots, so 'sport.*' matches 'sport.event.created'.
// Every other character is literal: regex metacharacters in a pattern
// ('+', '(', '|', '[', …) used to be live regex, so 'a+b' matched 'aab'.
export function matchesPattern(pattern: string, eventType: string): boolean {
	if (pattern === '*') return true;
	const literal = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
	return new RegExp('^' + literal.join('.*') + '$').test(eventType);
}
