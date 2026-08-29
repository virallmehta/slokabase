// src/tests/auth.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '#db/knex.js';
import { resetDatabase } from './testDb.js';

describe('Authentication API Integration Tests', () => {
  const testUser = {
    name: 'Pro Dev',
    email: 'prodev@example.com',
    password: 'securepassword123',
  };

  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('POST /api/v1/auth/register should create a new user profile', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user.role).toBe('member');
    expect(res.body.user.permissions).toEqual(['example-approvals:read']);
  });

  it('POST /api/v1/auth/register should block duplicate email registers', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(409); // Conflict

    expect(res.body.message).toBe('An account with this email already exists');
  });

  it('POST /api/v1/auth/login should set httpOnly cookies and return the user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body.user.email).toBe(testUser.email);

    const cookies = res.headers['set-cookie'];
    expect(cookies.some((c) => c.startsWith('access_token=') && c.includes('HttpOnly'))).toBe(
      true
    );
    expect(cookies.some((c) => c.startsWith('refresh_token=') && c.includes('HttpOnly'))).toBe(
      true
    );
    expect(cookies.some((c) => c.startsWith('csrf_token=') && !c.includes('HttpOnly'))).toBe(
      true
    );
  });

  it('POST /api/v1/auth/login should reject an invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'wrong-password' })
      .expect(401);

    expect(res.body.message).toBe('Invalid email or password');
  });
});
