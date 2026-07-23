import express from 'express';
import { mount } from '@fonderie/adapter-express';
import { fonderie } from './fonderie';

const app = express();

// Thin contract shim: rewrite crewfinding's paths (and one method) to Fonderie's,
// BEFORE the Fonderie bridge reads req.url/req.method. This is all an adopter with
// an existing frontend needs on top of the onResponse envelope mapping.
app.use((req, _res, next) => {
  const p = req.path;
  if (req.method === 'GET' && p === '/users/me') req.url = req.url.replace('/users/me', '/users');
  else if (req.method === 'PATCH' && p === '/users/me') { req.method = 'PUT'; req.url = '/users/profile'; }
  else if (req.method === 'POST' && p === '/auth/forgot-password') req.url = '/auth/email/forgot';
  else if (req.method === 'POST' && p === '/auth/reset-password') req.url = '/auth/email/reset';
  else if (req.method === 'POST' && p === '/auth/verify-email') req.url = '/auth/verify';
  else if (req.method === 'PUT' && /^\/workspaces\/[^/]+$/.test(p)) req.url = '/workspaces';
  next();
});

mount(app, fonderie);

const port = Number(process.env.PORT) || 3070;
app.listen(port, () => console.log('LISTENING ' + port));
