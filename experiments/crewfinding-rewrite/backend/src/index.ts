import express from 'express';
import { mount } from '@fonderie/adapter-express';
import { fonderie } from './fonderie';

const app = express();

// Thin path-alias shim: crewfinding contract paths -> Fonderie paths. Runs before
// the Fonderie bridge, rewriting req.url so the framework sees its own routes.
const ALIAS: Record<string, string> = {
  'POST /auth/forgot-password': '/auth/email/forgot',
  'POST /auth/reset-password': '/auth/email/reset',
  'POST /auth/verify-email': '/auth/verify',
};
app.use((req, _res, next) => {
  const key = req.method + ' ' + req.path;
  if (req.path === '/users/me') req.url = req.url.replace('/users/me', '/users');
  else if (ALIAS[key]) req.url = req.url.replace(req.path, ALIAS[key]);
  else if (req.method === 'PUT' && /^\/workspaces\/[^/]+$/.test(req.path)) req.url = '/workspaces';
  next();
});

mount(app, fonderie);

const port = Number(process.env.PORT) || 3070;
app.listen(port, () => console.log('LISTENING ' + port));
