import { sessionMiddleware }    from './session';
import { requireAuth }          from './require-auth';
import { requireVerifiedEmail } from './require-verified-email';

const middlewares = {
    requireAuth,
    sessionMiddleware,
    requireVerifiedEmail,
}

export default middlewares
