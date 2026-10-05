import { NOTIFICATION_EVENT } from '@fonderie/events';
import type { ICourierMessage } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import { getWorkspaceSettings } from './workspaces';

// Tell people when the team changes around them (docs/INSIDER-THREAT-DESIGN.md,
// Phase 2). Driven by the trail events, so a notice goes out only for a change
// that happened, through the durable outbox. The trail carries ids only; names
// and addresses are read here, at send time.
//
//   member.removed        → the person removed; the owner too, when a manager did it
//   manager.unset         → the person who is no longer a manager
//   ownership.offered     → the member it is offered to (Phase 4)
//   ownership.transferred → the PREVIOUS owner (the actor is the new owner)
//   manager.paused        → the owner: someone deleted too much too fast (Phase 5)

type Bus = { emit(type: string, payload: unknown): Promise<void> };

interface ITrail {
	workspaceId: string;
	userId: string | null;
	targetUserId?: string;
}

interface IPerson {
	id: string;
	email: string | null;
	phone: string | null;
	name: string | null;
}

export const TEAM_NOTICE_EVENTS = [
	EVENT_KEYS.memberRemoved,
	EVENT_KEYS.managerUnset,
	EVENT_KEYS.ownershipOffered,
	EVENT_KEYS.ownershipTransferred,
	EVENT_KEYS.managerPaused,
] as const;

export async function sendTeamNotice(store: IStoreAdapter, bus: Bus, type: string, t: ITrail): Promise<void> {
	if (!t.targetUserId || t.targetUserId === t.userId) return;
	const extra = t as ITrail & { actions?: number; windowMinutes?: number };
	const [ws] = await store.query<{ name: string; ownerId: string }>(
		`SELECT name, owner_id AS "ownerId" FROM fonderie_workspaces WHERE id = $1`,
		[t.workspaceId],
	);
	if (!ws) return;
	const { locale } = await getWorkspaceSettings(t.workspaceId, store);
	const ids = [t.targetUserId, t.userId, ws.ownerId].filter((x): x is string => !!x);
	// Accounts awaiting deletion are not written to: they asked to leave.
	const people = new Map(
		(
			await store.query<IPerson>(
				`SELECT id, email, phone, NULLIF(trim(concat_ws(' ', first_name, last_name)), '') AS name
				 FROM fonderie_users WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
				[ids],
			)
		).map((p) => [p.id, p]),
	);
	const target = people.get(t.targetUserId);
	const actor = t.userId ? people.get(t.userId) : undefined;
	const nameOf = (p: IPerson | undefined) => p?.name ?? p?.email ?? '';

	const send = async (to: IPerson | undefined, message: string, data: Record<string, string>) => {
		if (!to || (!to.email && !to.phone)) return;
		await bus.emit(NOTIFICATION_EVENT, {
			type: message,
			// No `locale`: the recipient's own account decides; the business's
			// language is the fallback.
			fallbackLocale: locale,
			recipient: to.email
				? { email: to.email, phone: null, deviceToken: null }
				: { email: null, phone: to.phone, deviceToken: null },
			data,
		} satisfies ICourierMessage);
	};

	switch (type) {
		case EVENT_KEYS.memberRemoved:
			await send(target, MESSAGE_KEYS.memberRemoved, { workspaceName: ws.name, actorName: nameOf(actor) });
			if (t.userId && t.userId !== ws.ownerId) {
				await send(people.get(ws.ownerId), MESSAGE_KEYS.memberRemovedAlert, {
					workspaceName: ws.name,
					actorName: nameOf(actor),
					memberName: nameOf(target) || t.targetUserId,
				});
			}
			return;
		case EVENT_KEYS.managerUnset:
			await send(target, MESSAGE_KEYS.managerRemoved, { workspaceName: ws.name });
			return;
		case EVENT_KEYS.ownershipOffered:
			await send(target, MESSAGE_KEYS.ownershipOffered, { workspaceName: ws.name, ownerName: nameOf(actor) });
			return;
		case EVENT_KEYS.managerPaused:
			await send(people.get(ws.ownerId), MESSAGE_KEYS.managerPaused, {
				workspaceName: ws.name,
				memberName: nameOf(target) || t.targetUserId,
				count: String(extra.actions ?? ''),
				minutes: String(extra.windowMinutes ?? ''),
			});
			return;
				case EVENT_KEYS.ownershipTransferred:
			await send(target, MESSAGE_KEYS.ownershipAccepted, { workspaceName: ws.name, newOwnerName: nameOf(actor) });
			return;
	}
}
