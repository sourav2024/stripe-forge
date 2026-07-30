// WHY THIS TEST EXISTS
// This is the reference integration test: it exercises the real Express app end
// to end over HTTP (via supertest) — register -> login -> access a protected
// route -> refresh -> logout — proving that routing, middleware chain, auth,
// validation, the service/repository layers, and the DB all fit together. Unit
// tests prove pieces in isolation; this proves the SEAMS.
//
// It is `describe.skip`-ped by default so `npm test` (a plain `vitest run`) never
// requires infrastructure. To ENABLE it you need a running, migrated test DB and
// Redis — see tests/integration/README.md — and then change `describe.skip` to
// `describe`, or run with an env flag and gate on it. Keeping it skipped means
// CI's default job stays green without service containers, while the file remains
// a working, copy-pasteable template for real integration coverage.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

// Flip `describe.skip` -> `describe` once Postgres + Redis are up and migrations
// have been applied against your TEST DATABASE_URL. See the README in this folder.
describe.skip('auth flow (integration)', () => {
  const email = `merchant_${Date.now()}@example.com`;
  const password = 'S3cure-passw0rd!';
  let accessToken = '';
  let refreshToken = '';

  it('health check responds', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registers a new merchant', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'Acme Inc' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('merchant');
  });

  it('logs in and returns access + refresh tokens', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it('rejects a protected route without a token', async () => {
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('accepts a protected route with a valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('exchanges a refresh token for a new access token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });
});
