import { withSession }          from './session';
import { requireAuth }          from './require-auth';
import { requireVerifiedEmail } from './require-verified-email';

const middlewares = {
    requireAuth,
    withSession,
    requireVerifiedEmail,
}

export default middlewares
