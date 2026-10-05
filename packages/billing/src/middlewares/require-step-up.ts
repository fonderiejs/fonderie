import { HTTP, setApiResponse } from '@fonderie/core';
import type { IFonderieContext, Middleware } from '@fonderie/core';

// Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4): this move needs a fresh
// proof that the signed-in person is still them (POST /auth/step-up, sent back
// as X-Step-Up). @fonderie/auth (7.27+) puts the verifier on every request;
// this brick asks it by shape and does not import auth. No verifier → refuse:
// a guard that cannot check must not wave the move through.
export const STEP_UP_VERIFIER = 'fonderie.auth.stepUp';

export function requireStepUp(when: (ctx: IFonderieContext) => boolean = () => true): Middleware {
	return async (ctx, next) => {
		if (!when(ctx)) return next();
		const verify = ctx.meta[STEP_UP_VERIFIER] as ((c: IFonderieContext) => Promise<boolean>) | undefined;
		if (typeof verify !== 'function') {
			return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Step-up is not available: register @fonderie/auth 7.27 or later.');
		}
		if (!(await verify(ctx))) {
			return setApiResponse(HTTP.FORBIDDEN, 'STEP_UP_REQUIRED', 'Confirm it’s you to do this.');
		}
		return next();
	};
}
