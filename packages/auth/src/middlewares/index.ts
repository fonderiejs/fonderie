import { withSession } from './session';
import { requireAuth } from './require-auth';

const middlewares = {
    requireAuth,
    withSession,
}

export default middlewares
