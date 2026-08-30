import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app.js';
import { db } from '#db/knex.js';
import { resetDatabase } from '../../../src/tests/testDb.js';

function getCsrfToken(res) {
  const cookies = res.headers['set-cookie'];
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('Example Approvals module — /api/v1/example-approvals', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };
  const member = {
    name: 'Approvals Member',
    email: 'example-approvals-member@example.com',
    password: 'memberpassword123',
  };

  let adminAgent;
  let adminCsrf;
  let approvalId;

  beforeAll(async () => {
    await resetDatabase();
    await request(app).post('/api/v1/auth/register').send(member).expect(201);

    adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = getCsrfToken(loginRes);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates an approval in the draft state', async () => {
    const res = await adminAgent
      .post('/api/v1/example-approvals')
      .set('X-CSRF-Token', adminCsrf)
      .send({ title: 'Q3 budget' })
      .expect(201);

    expect(res.body.approval).toMatchObject({ title: 'Q3 budget', state: 'draft' });
    approvalId = res.body.approval.id;
  });

  it('rejects a transition to a state not reachable from draft', async () => {
    const res = await adminAgent
      .post(`/api/v1/example-approvals/${approvalId}/transition`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ to: 'approved' })
      .expect(400);
    expect(res.body.message).toBe('Invalid transition');
  });

  it('moves draft to submitted', async () => {
    const res = await adminAgent
      .post(`/api/v1/example-approvals/${approvalId}/transition`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ to: 'submitted' })
      .expect(200);
    expect(res.body.approval.state).toBe('submitted');
  });

  it("denies a member (lacks example-approvals:approve) from approving", async () => {
    const memberAgent = request.agent(app);
    const loginRes = await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: member.password })
      .expect(200);
    const memberCsrf = getCsrfToken(loginRes);

    const res = await memberAgent
      .post(`/api/v1/example-approvals/${approvalId}/transition`)
      .set('X-CSRF-Token', memberCsrf)
      .send({ to: 'approved' })
      .expect(403);
    expect(res.body.message).toBe('You do not have permission to perform this action');
  });

  it('lists only the transitions the caller is permitted to take', async () => {
    const res = await adminAgent.get(`/api/v1/example-approvals/${approvalId}/transitions`).expect(200);
    expect(res.body.transitions.sort()).toEqual(['approved', 'draft', 'rejected']);
  });

  it('approves the submitted request', async () => {
    const res = await adminAgent
      .post(`/api/v1/example-approvals/${approvalId}/transition`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ to: 'approved' })
      .expect(200);
    expect(res.body.approval.state).toBe('approved');
  });
});
