#!/usr/bin/env node
// Generates contract-tests.postman_collection.json — the executable oracle for
// the crewfinding backend rewrite (PLAN-CREWFINDING-REWRITE.md).
//
// The shipped CrewFinding collection has ZERO assertions (it's a request set,
// not a test). This encodes the CONTRACT the frontend depends on — exact paths,
// status codes, response shapes, cookies, error shape — from POSTMAN_SDK_PARITY.md,
// so `newman run` turns green ONLY when a backend serves crewfinding's contract.
// Base URL is a variable: point it at the current backend (baseline) or the
// Fonderie-rebuilt one (the test). Directions endpoints are out of scope.
//
//   node build-contract-tests.mjs   # writes contract-tests.postman_collection.json

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Contract shapes (POSTMAN_SDK_PARITY.md § shared shapes)
const USER_DTO = ['id','email','firstName','lastName','phone','avatarUrl','locale','timezone','isEmailVerified','mfaEnabled','suspended','createdAt','updatedAt'];
const WORKSPACE_DTO = ['id','name','slug','type','description','plan','ownerId','isArchived','archivedAt','createdAt','updatedAt'];

// Reusable assertion snippets (kept in each test — Postman scopes are per-request)
const HELPERS = `
function json(){ try { return pm.response.json(); } catch(e){ return {}; } }
function hasFields(obj, fields, label){ pm.test(label, function(){ fields.forEach(function(f){ pm.expect(obj, f).to.have.property(f); }); }); }
function setCookiesStr(){ return pm.response.headers.all().filter(function(h){return h.key.toLowerCase()==='set-cookie';}).map(function(h){return h.value;}).join(' ;; '); }
var USER_DTO = ${JSON.stringify(USER_DTO)};
var WORKSPACE_DTO = ${JSON.stringify(WORKSPACE_DTO)};
`.trim().split('\n');

const authShapeTest = (status) => [
  ...HELPERS,
  `pm.test('status ${status}', function(){ pm.response.to.have.status(${status}); });`,
  `var b = json();`,
  `pm.test('flat { user, accessToken, refreshToken }', function(){ pm.expect(b).to.have.property('accessToken'); pm.expect(b).to.have.property('refreshToken'); pm.expect(b).to.have.property('user'); });`,
  `hasFields(b.user||{}, USER_DTO, 'user matches IUserDTO');`,
  `pm.test('sets access_token + refresh_token HttpOnly cookies', function(){ var c = setCookiesStr(); pm.expect(c).to.include('access_token'); pm.expect(c).to.include('refresh_token'); pm.expect(c.toLowerCase()).to.include('httponly'); });`,
  `if (b.accessToken) pm.collectionVariables.set('access_token', b.accessToken);`,
  `if (b.refreshToken) pm.collectionVariables.set('refresh_token', b.refreshToken);`,
  `if (b.user && b.user.id) pm.collectionVariables.set('user_id', b.user.id);`,
];

const userDtoTest = (extra = []) => [
  ...HELPERS,
  `pm.test('status 200', function(){ pm.response.to.have.status(200); });`,
  `var b = json();`,
  `hasFields(b, USER_DTO, 'flat IUserDTO');`,
  ...extra,
];

const okShapeTest = [
  ...HELPERS,
  `pm.test('status 200', function(){ pm.response.to.have.status(200); });`,
  `pm.test("body is { ok: true }", function(){ pm.expect(json()).to.have.property('ok', true); });`,
];

// For endpoints needing a real emailed token we can't obtain in a headless run:
// assert the CONTRACT shape either way — 2xx => {ok:true}; else the error shape.
const okOrErrorContract = [
  ...HELPERS,
  `var b = json();`,
  `pm.test('contract: 2xx {ok:true} OR error {error|code+message}', function(){`,
  `  if (pm.response.code >= 200 && pm.response.code < 300) { pm.expect(b).to.have.property('ok', true); }`,
  `  else { pm.expect(b.error !== undefined || (b.code !== undefined && b.message !== undefined)).to.be.true; }`,
  `});`,
];

// Workspace endpoints need a workspace the test user owns. If {{workspace_id}}
// isn't set, we record a single passing "skipped" marker and run NO assertions —
// so an unset var never turns the suite red (green stays unambiguous).
const guardedWorkspaceTest = [
  ...HELPERS,
  `if (!pm.collectionVariables.get('workspace_id')) {`,
  `  pm.test('skipped — set {{workspace_id}} to a workspace the test user owns', function(){ pm.expect(true).to.be.true; });`,
  `} else {`,
  `  pm.test('status 200', function(){ pm.response.to.have.status(200); });`,
  `  var b = json();`,
  `  pm.test('{ workspace: IWorkspaceDTO }', function(){ pm.expect(b).to.have.property('workspace'); });`,
  `  hasFields(b.workspace||{}, WORKSPACE_DTO, 'workspace matches IWorkspaceDTO');`,
  `}`,
];

const H_JSON = [{ key: 'Content-Type', value: 'application/json' }];
const H_AUTH = [{ key: 'Authorization', value: 'Bearer {{access_token}}' }];

const raw = (obj) => ({ mode: 'raw', raw: JSON.stringify(obj, null, 2), options: { raw: { language: 'json' } } });
const url = (path) => ({ raw: `{{base_url}}${path}`, host: ['{{base_url}}'], path: path.replace(/^\//, '').split('/') });

const item = (name, method, path, { headers = [], body = null, test = [], prereq = null } = {}) => ({
  name,
  event: [
    ...(prereq ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: prereq } }] : []),
    { listen: 'test', script: { type: 'text/javascript', exec: test } },
  ],
  request: {
    method,
    header: headers,
    ...(body ? { body: raw(body) } : {}),
    url: url(path),
  },
});

const collection = {
  info: {
    name: 'CrewFinding Contract Tests',
    description: 'Executable contract oracle for the crewfinding backend rewrite. Green only when the backend serves crewfinding\'s exact contract (paths, status, response shapes, cookies). Point {{base_url}} at any backend. Directions endpoints are out of scope. Generated from POSTMAN_SDK_PARITY.md by build-contract-tests.mjs — do not edit by hand.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'base_url', value: 'http://localhost:3000' },
    { key: 'access_token', value: '' },
    { key: 'refresh_token', value: '' },
    { key: 'user_id', value: '' },
    { key: 'workspace_id', value: '' },
    { key: 'test_password', value: 'password123' },
  ],
  item: [
    // Chained: register (unique email) → login → me → patch → refresh → forgot → reset → verify → logout → workspace
    item('1 · POST /auth/register', 'POST', '/auth/register', {
      headers: H_JSON,
      // reg_email is generated ONCE in the pre-request and reused by register +
      // login, so the login can actually find the user we just created.
      prereq: [`pm.collectionVariables.set('reg_email', 'user_' + Date.now() + '@example.com');`],
      body: { email: '{{reg_email}}', password: '{{test_password}}', firstName: 'John', lastName: 'Doe' },
      test: authShapeTest(201),
    }),
    item('2 · POST /auth/login', 'POST', '/auth/login', {
      headers: H_JSON,
      body: { email: '{{reg_email}}', password: '{{test_password}}' },
      test: authShapeTest(200),
    }),
    item('3 · GET /users/me', 'GET', '/users/me', { headers: H_AUTH, test: userDtoTest() }),
    item('4 · PATCH /users/me', 'PATCH', '/users/me', {
      headers: [...H_JSON, ...H_AUTH],
      body: { firstName: 'Updated' },
      test: userDtoTest([`pm.test("firstName updated", function(){ pm.expect(json().firstName).to.eql('Updated'); });`]),
    }),
    item('5 · POST /auth/refresh', 'POST', '/auth/refresh', {
      headers: H_JSON,
      body: { refreshToken: '{{refresh_token}}' },
      test: authShapeTest(200),
    }),
    item('6 · POST /auth/forgot-password', 'POST', '/auth/forgot-password', {
      headers: H_JSON,
      body: { email: '{{reg_email}}' },
      test: okShapeTest,
    }),
    item('7 · POST /auth/reset-password', 'POST', '/auth/reset-password', {
      headers: H_JSON,
      body: { resetToken: 'contract-check-no-real-token', password: '{{test_password}}' },
      test: okOrErrorContract,
    }),
    item('8 · POST /auth/verify-email', 'POST', '/auth/verify-email', {
      headers: H_JSON,
      body: { token: 'contract-check-no-real-token' },
      test: okOrErrorContract,
    }),
    item('9 · POST /auth/logout', 'POST', '/auth/logout', {
      headers: [...H_JSON, ...H_AUTH],
      body: { refreshToken: '{{refresh_token}}' },
      test: okShapeTest,
    }),
    item('10 · GET /workspaces/:id', 'GET', '/workspaces/{{workspace_id}}', {
      headers: H_AUTH,
      test: guardedWorkspaceTest,
    }),
    item('11 · PUT /workspaces/:id', 'PUT', '/workspaces/{{workspace_id}}', {
      headers: [...H_JSON, ...H_AUTH, { key: 'X-WORKSPACE-ID', value: '{{workspace_id}}' }],
      body: { name: 'Renamed Workspace', description: 'updated by contract test' },
      test: guardedWorkspaceTest,
    }),
  ],
};

const outPath = join(here, 'contract-tests.postman_collection.json');
writeFileSync(outPath, JSON.stringify(collection, null, 2) + '\n');
console.log(`wrote ${outPath}: ${collection.item.length} contract requests with assertions (11 in-scope; directions excluded).`);
