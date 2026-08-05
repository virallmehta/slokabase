import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '#db/knex.js';
import { resetDatabase } from './testDb.js';

describe('authorize() middleware — permission-based access control', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };
  const member = {
    name: 'Regular Member',
    email: 'member@example.com',
    password: 'memberpassword123',
  };

  beforeAll(async () => {
    await resetDatabase();
    await request(app).post('/api/v1/auth/register').send(member).expect(201);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('allows a user with the required permission (admin -> users:read)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send(adminCredentials).expect(200);

    const res = await agent.get('/api/v1/users').expect(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('denies a user without the required permission (member lacks users:read)', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: member.password })
      .expect(200);

    const res = await agent.get('/api/v1/users').expect(403);
    expect(res.body.message).toBe('You do not have permission to perform this action');
  });

  it('denies an unauthenticated request before permissions are even checked', async () => {
    await request(app).get('/api/v1/users').expect(401);
  });
});
