// src/tests/leads.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '#db/knex.js';
import { resetDatabase } from './testDb.js';

describe('Leads API Integration Tests', () => {

  // Before running tests, clear out the DB structure and refresh migrations/seeds
  beforeAll(async () => {
    await resetDatabase();
  });

  // Clean up database connection pools after all tests wrap up
  afterAll(async () => {
    await db.destroy();
  });

  it('GET /api/v1/leads should return all seeded leads', async () => {
    const res = await request(app)
      .get('/api/v1/leads')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('name');
    expect(res.body.data[0]).toHaveProperty('email');
  });

  it('POST /api/v1/leads should reject invalid payload details with a 400 status', async () => {
    const invalidPayload = {
      name: 'X',            // Too short!
      email: 'notanemail'   // Bad formatting!
    };

    const res = await request(app)
      .post('/api/v1/leads')
      .send(invalidPayload)
      .expect('Content-Type', /json/)
      .expect(400); // Expect bad request code

    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBe(2); // Two validation violations caught!
  });

  it('POST /api/v1/leads should securely add new leads', async () => {
    const newLead = {
      name: 'Testing Pro',
      email: 'testpro@example.com',
    };

    const res = await request(app)
      .post('/api/v1/leads')
      .send(newLead)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('id');
    
    // Double check it actually exists in the database now
    const checkDb = await db('leads').where({ email: newLead.email }).first();
    expect(checkDb).toBeDefined();
    expect(checkDb.name).toBe(newLead.name);
  });


});
