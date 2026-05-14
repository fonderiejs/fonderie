// Glob matching for event topic patterns.
// '*' alone matches everything. Otherwise '*' is a wildcard for any
// characters including dots, so 'sport.*' matches 'sport.event.created'.
export function matchesPattern(pattern: string, eventType: string): boolean {
	if (pattern === '*') return true;
	const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
	return regex.test(eventType);
}
