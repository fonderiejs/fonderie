/**
 * Turn a drain failure into something that names its own most likely cause.
 *
 * Migrations run out of band, so a deploy routinely goes live ahead of them.
 * Publishing keeps working — it touches no new column — while every drain
 * fails on a column that does not exist yet. The raw error reads as "the queue
 * is broken"; the actual fix is one command, and nothing is lost in the
 * meantime because the rows are durable.
 *
 * Anything else is returned unchanged: guessing at causes you cannot see is
 * worse than saying what happened.
 */
export function explainDrainFailure(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	if (/column .* does not exist/i.test(message)) {
		return (
			`${message} — this deployment is ahead of its migrations. Run your migration ` +
			`step against this database; queued work is durable and delivers once it lands.`
		);
	}
	if (/relation .* does not exist/i.test(message)) {
		return (
			`${message} — @fonderie/events migrations have not been applied to this ` +
			`database. Run them, then drain again; nothing is lost in the meantime.`
		);
	}
	return message;
}
