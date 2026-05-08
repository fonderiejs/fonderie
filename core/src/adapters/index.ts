// Internal barrel — not listed in package.json exports
// Consumed by FonderieApp methods only

export type { KoaContext }                            from './koa';
export { koaContextToWeb, webResponseToKoa }          from './koa';
export { expressRequestToWeb, webResponseToExpress } from './express';
export type { ExpressRequest, ExpressResponse }       from './express';
