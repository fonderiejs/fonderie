// Moved to @fonderie/core/middlewares so every package shares one validation
// middleware (same 422 envelope, same parse semantics). Re-exported here for
// back-compat.
export { validate } from '@fonderie/core/middlewares';
