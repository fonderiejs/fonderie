import jwt from 'jsonwebtoken';
import type { IFonderieContext } from '@fonderie/core';

import type { IAuthConfig } from '../config';
import { keyIdOf, verifyToken } from './jwt';

// Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4): a few minutes of proof that
// the signed-in person is still them, asked before a big move — handing a team
// over, ending a plan at once, adding a webhook that receives every event. A
// stolen session or a colleague's unlocked phone cannot do those alone.
//
// The proof is a short-lived token (type 'step-up', never a session) the client
// sends as `X-Step-Up`. Other bricks do not import auth: AuthModule puts a
// verifier on every request under STEP_UP_VERIFIER, and a guarded route asks it.

export const STEP_UP_TTL_SECONDS = 5 * 60;
export const STEP_UP_HEADER = 'x-step-up';
/** ctx.meta key of the verifier AuthModule installs: (ctx) => Promise<boolean>. */
export const STEP_UP_VERIFIER = 'fonderie.auth.stepUp';

export type StepUpMethod = 'password' | 'mfa' | 'email' | 'sms';

interface IStepUpPayload {
	sub: string;
	type: 'step-up';
	method: StepUpMethod;
}

export function issueStepUpToken(userId: string, method: StepUpMethod, config: Pick<IAuthConfig, 'jwtSecret'>): { token: string; expiresAt: string } {
	const token = jwt.sign({ sub: userId, type: 'step-up', method } satisfies IStepUpPayload, config.jwtSecret, {
		expiresIn: STEP_UP_TTL_SECONDS,
		keyid: keyIdOf(config.jwtSecret),
	});
	return { token, expiresAt: new Date(Date.now() + STEP_UP_TTL_SECONDS * 1000).toISOString() };
}

/** Whether this request carries a fresh step-up proof for the signed-in user. */
export function hasStepUp(ctx: IFonderieContext, config: IAuthConfig): boolean {
	const userId = ctx.user?.id;
	const token = ctx.request.headers.get(STEP_UP_HEADER);
	if (!userId || !token) return false;
	const payload = verifyToken(token, config) as unknown as Partial<IStepUpPayload> | null;
	return !!payload && payload.type === 'step-up' && payload.sub === userId;
}

/**
 * Which proofs this account can give, strongest first: with two-factor on, the
 * authenticator is the only one (a password alone is what a thief may have);
 * otherwise its password, else a code to its email or phone.
 */
export function stepUpMethods(user: { mfaEnabled?: boolean | null; hasPassword: boolean; email: string | null; phone: string | null }): StepUpMethod[] {
	if (user.mfaEnabled) return ['mfa'];
	const methods: StepUpMethod[] = [];
	if (user.hasPassword) methods.push('password');
	if (user.email) methods.push('email');
	if (user.phone) methods.push('sms');
	return methods;
}
