import type { IStoreAdapter } from '@fonderie/store';

import type { ISecretEncryptor } from '../crypto';

// Every secret write and every rotation meet on one advisory lock: writes take
// it shared (they do not wait for each other), a rotation takes it exclusive.
// A write therefore runs entirely before a rotation or entirely after it — never
// encrypting under the old key and landing after the re-encryption.
const KEY_LOCK = `fonderie_secrets_key`;

export async function lockForSecretWrite(tx: IStoreAdapter): Promise<void> {
	await tx.query(`SELECT pg_advisory_xact_lock_shared(hashtext($1))`, [KEY_LOCK]);
}

export async function lockForRotation(tx: IStoreAdapter): Promise<void> {
	await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [KEY_LOCK]);
}

// The plaintext of the key check. Not a secret: knowing it does not help
// decrypt anything, it only lets an encryptor prove it holds the current key.
const KEY_CHECK = 'fonderie-secret-key-check:v1';

export const sealKeyCheck = (encryptor: ISecretEncryptor): string => encryptor.encrypt(KEY_CHECK);

/**
 * Refuse a write from an encryptor that is not the one the stored secrets are
 * under. Serialization alone is not enough: an instance still running with the
 * old key after a rotation would encrypt with it, and every value it wrote
 * would be unreadable once the old key is gone. Nothing is checked until the
 * first rotation records a key check, nor before the migration that holds it.
 */
export async function assertCurrentKey(
	tx: IStoreAdapter,
	encryptor: ISecretEncryptor,
): Promise<void> {
	const [table] = await tx.query<{ present: boolean }>(
		`SELECT to_regclass('fonderie_secret_key_check') IS NOT NULL AS present`,
	);
	if (!table?.present) return;
	const [row] = await tx.query<{ checkValue: string }>(
		`SELECT check_value AS "checkValue" FROM fonderie_secret_key_check`,
	);
	if (!row) return;
	let ok = false;
	try {
		ok = encryptor.decrypt(row.checkValue) === KEY_CHECK;
	} catch {
		ok = false;
	}
	if (!ok) {
		throw new Error(
			'[config] refusing to write a secret: this instance is not using the key the stored ' +
				'secrets were rotated to. Restart it with the current CONFIG_SECRET_KEY.',
		);
	}
}
