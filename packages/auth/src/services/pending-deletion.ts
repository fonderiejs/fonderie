import { setApiResponse, HTTP } from '@fonderie/core';

import { deletionGracePeriodDays, type IAuthConfig } from '../config';

// What an ARCHIVED account (deleted, inside its grace period) answers — the
// account-deletion design (docs/ACCOUNT-DELETION-DESIGN.md), Phase 1.
//
// Two shapes, on purpose:
//   - after the person PROVED it is theirs (right password, verified Google /
//     Apple identity): 403 with the dates, so a screen can say "deletion
//     requested on …, your account will be deleted on …";
//   - before any proof (sign-up with the address): 409, no dates — the same
//     existence signal a 409 USER_ALREADY_EXISTS already gives, nothing more.

/** When the purge erases an account deleted at `deletedAt`. */
export function deletionDate(deletedAt: Date, config: Pick<IAuthConfig, 'accountDeletion'>): Date {
	return new Date(deletedAt.getTime() + deletionGracePeriodDays(config) * 24 * 60 * 60 * 1000);
}

export function pendingDeletionResponse(deletedAt: Date, config: Pick<IAuthConfig, 'accountDeletion'>): Response {
	const deleteOn = deletionDate(deletedAt, config);
	return setApiResponse(
		HTTP.FORBIDDEN,
		'ACCOUNT_PENDING_DELETION',
		`This account is scheduled for deletion on ${deleteOn.toISOString().slice(0, 10)}.`,
		{ requestedAt: deletedAt.toISOString(), deleteOn: deleteOn.toISOString() },
	);
}

export function archivedAddressResponse(): Response {
	return setApiResponse(
		HTTP.CONFLICT,
		'ACCOUNT_PENDING_DELETION',
		'An account using this address is scheduled for deletion. Sign in to keep it, or wait until it is deleted.',
	);
}
