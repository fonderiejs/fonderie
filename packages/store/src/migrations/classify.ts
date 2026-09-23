// What a migration will do to data that already exists.
//
// Additive DDL can be applied by a pipeline without anyone watching: the worst
// case is a table nobody uses yet. Destructive DDL cannot — it is the one class
// where "the deploy ran it" and "a human decided" must not be the same thing,
// because the data is gone and no down-migration brings it back. An empty table
// recreated by a rollback is not a rollback.
//
// So this does not block anything. It labels, and the caller decides: CI fails
// the deploy until a destructive migration is approved explicitly, a dry-run
// prints the statements, an operator reads them before pressing anything.

export type MigrationImpact = 'additive' | 'destructive';

export interface IMigrationClassification {
	impact: MigrationImpact;
	// The statements that earned the label, as written — so a caller can show
	// WHAT will be lost rather than a generic warning.
	destructive: string[];
}

// Conservative on purpose: a false "destructive" costs one explicit approval,
// a false "additive" costs the data. DROP TABLE/COLUMN and TRUNCATE lose rows;
// ALTER COLUMN ... TYPE can fail or silently coerce, so it is flagged too.
const DESTRUCTIVE = [
	/\bDROP\s+TABLE\b/i,
	/\bDROP\s+COLUMN\b/i,
	/\bDROP\s+SCHEMA\b/i,
	/\bDROP\s+DATABASE\b/i,
	/\bTRUNCATE\b/i,
	/\bALTER\s+COLUMN\s+\w+\s+TYPE\b/i,
];

// Line comments only. A destructive statement inside a /* */ block would be
// flagged — the conservative direction, and the alternative is parsing SQL.
const stripLineComments = (sql: string): string =>
	sql
		.split('\n')
		.map((l) => l.replace(/--.*$/, ''))
		.join('\n');

export function classifyMigration(sql: string): IMigrationClassification {
	const code = stripLineComments(sql);
	const destructive: string[] = [];

	// Split on ';' rather than reporting the whole file: the operator needs the
	// three DROPs, not four hundred lines to read them out of.
	for (const raw of code.split(';')) {
		const stmt = raw.trim().replace(/\s+/g, ' ');
		if (!stmt) continue;
		if (DESTRUCTIVE.some((re) => re.test(stmt))) destructive.push(stmt);
	}

	return { impact: destructive.length > 0 ? 'destructive' : 'additive', destructive };
}
