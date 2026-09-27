// English — canonical: this shape defines the keys fr and es must match.
const migrations = {
	title: 'Migrations',
	lead: 'Schema changes each module ships, and whether this database has them.',
	needsWrite: 'Applying migrations needs a token with the write scope.',
	firstInstall:
		'This database has never been migrated — treating it as a first install, so nothing is held back.',
	upToDate: 'Every module is up to date',
	noPending: 'No pending migrations.',
	pendingCount: '{n} pending',
	destructive: 'destructive',
	additive: 'additive',
	blockedBy: 'Apply "{module}" first — it runs before this one and is behind.',
	destructiveBlocked:
		'Contains a migration that deletes data. No down-migration brings it back — apply this one through CI or `npm run migrate`.',
	confirmApply: 'Apply {n} migration(s) to "{module}"? This changes the database schema.',
	applyOne: 'Apply 1 migration',
	applyMany: 'Apply {n} migrations',
};
export default migrations;
