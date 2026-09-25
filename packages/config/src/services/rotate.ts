import type { IStoreAdapter } from '@fonderie/store';

import type { ISecretEncryptor } from '../crypto';

export interface IRotationReport {
	/** Rows re-encrypted in `fonderie_secrets`. */
	secrets: number;
	/** Rows re-encrypted in `fonderie_secret_revisions`. */
	revisions: number;
}

/**
 * Re-encrypt every stored secret from one key to another.
 *
 * Without this, `CONFIG_SECRET_KEY` is permanent. Stored values are AES-GCM
 * ciphertext under it, so changing the key makes every secret undecryptable and
 * losing it makes them unrecoverable — a one-way door on a routine operational
 * task (a leaked key, an employee leaving, an annual rotation policy).
 *
 * ## Revisions are re-encrypted too, and that is the point
 *
 * `fonderie_secret_revisions.value` holds ciphertext as well. A rotation that
 * touched only `fonderie_secrets` would appear to work — every reveal would
 * succeed — and would quietly destroy every rollback target. The failure would
 * surface later, as `rollbackSecret()` restoring a value encrypted under a key
 * nobody has any more. Both tables move together or neither does.
 *
 * ## Deliberately not an HTTP route
 *
 * Rotating needs the NEW key, and exposing it over the admin surface would mean
 * putting a fresh master key in a request body, through whatever logs and proxies
 * sit in front of it. This is a library call: run it from a script or a one-off
 * job, out of band, with both keys in the environment.
 *
 * ## Failure behaviour
 *
 * Runs in a single transaction, so a partial rotation cannot exist — that state
 * is unrecoverable once the old key is discarded.
 *
 * Every value is decrypted with `from` and re-encrypted with `to` in memory
 * BEFORE anything is written. A wrong `from` key therefore fails having changed
 * nothing, rather than part-way through.
 *
 * Not idempotent, deliberately. Running it twice with the same pair throws on
 * the second run, because the values no longer decrypt under `from`. That is the
 * safe direction: it refuses rather than double-encrypting.
 *
 * @example
 * const report = await rotateSecretKey(
 *   store,
 *   createAesGcmEncryptor(process.env.CONFIG_SECRET_KEY_OLD!),
 *   createAesGcmEncryptor(process.env.CONFIG_SECRET_KEY!),
 * );
 * // → { secrets: 12, revisions: 47 }
 */
export async function rotateSecretKey(
	store: IStoreAdapter,
	from: ISecretEncryptor,
	to: ISecretEncryptor,
): Promise<IRotationReport> {
	return store.transaction(async (tx) => {
		// Lock the rows for the duration: a concurrent setSecret() would write
		// under the OLD key after we had read it and before we commit, leaving one
		// value nobody can read. FOR UPDATE makes that write wait for the commit.
		const secrets = await tx.query<{ id: string; value: string }>(
			`SELECT id, value FROM fonderie_secrets FOR UPDATE`,
		);
		const revisions = await tx.query<{
			key: string;
			environment: string;
			version: number;
			value: string;
		}>(
			`SELECT key, environment, version, value FROM fonderie_secret_revisions FOR UPDATE`,
		);

		// Transform everything first. A wrong `from` key must fail before any
		// write, not half way through a table.
		const nextSecrets = secrets.map((row) => ({
			id: row.id,
			value: reencrypt(from, to, row.value, `fonderie_secrets id=${row.id}`),
		}));
		const nextRevisions = revisions.map((row) => ({
			key: row.key,
			environment: row.environment,
			version: row.version,
			value: reencrypt(
				from,
				to,
				row.value,
				`fonderie_secret_revisions ${row.key}@${row.environment} v${row.version}`,
			),
		}));

		for (const row of nextSecrets) {
			await tx.query(`UPDATE fonderie_secrets SET value = $1 WHERE id = $2`, [row.value, row.id]);
		}
		for (const row of nextRevisions) {
			await tx.query(
				`UPDATE fonderie_secret_revisions SET value = $1
				 WHERE key = $2 AND environment = $3 AND version = $4`,
				[row.value, row.key, row.environment, row.version],
			);
		}

		return { secrets: nextSecrets.length, revisions: nextRevisions.length };
	});
}

// Name the row that failed. "unable to authenticate data" on its own tells an
// operator mid-rotation nothing about which value is wrong or whether they have
// the right old key at all.
function reencrypt(
	from: ISecretEncryptor,
	to: ISecretEncryptor,
	value: string,
	where: string,
): string {
	let plain: string;
	try {
		plain = from.decrypt(value);
	} catch (err) {
		throw new Error(
			`[config] rotation aborted: cannot decrypt ${where} with the OLD key ` +
				`(${(err as Error).message}). Nothing was written. Check CONFIG_SECRET_KEY_OLD ` +
				'is the key these values were encrypted with.',
		);
	}
	return to.encrypt(plain);
}
