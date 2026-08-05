import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '#db/knex.js';
import { resetDatabase } from './testDb.js';

function getCsrfToken(res) {
  const cookies = res.headers['set-cookie'];
  const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
  return csrfCookie.split(';')[0].split('=')[1];
}

describe('Products module — /api/v1/products', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };
  const member = {
    name: 'Products Member',
    email: 'products-member@example.com',
    password: 'memberpassword123',
  };

  let adminAgent;
  let adminCsrf;
  let productId;

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

  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/v1/products').expect(401);
  });

  it('denies a member (lacks products:write) from creating a product', async () => {
    const memberAgent = request.agent(app);
    await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: member.password })
      .expect(200);

    await memberAgent
      .post('/api/v1/products')
      .send({ name: 'Widget', sku: 'WID-1', price: 9.99 })
      .expect(403);
  });

  it('rejects a mutating request without a matching CSRF header', async () => {
    await adminAgent
      .post('/api/v1/products')
      .send({ name: 'Widget', sku: 'WID-1', price: 9.99 })
      .expect(403);
  });

  it('rejects an invalid payload', async () => {
    const res = await adminAgent
      .post('/api/v1/products')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: '', sku: '', price: -1 })
      .expect(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('creates a product', async () => {
    const res = await adminAgent
      .post('/api/v1/products')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Widget', sku: 'WID-1', price: 9.99, stock: 50 })
      .expect(201);

    expect(res.body.product).toMatchObject({ name: 'Widget', sku: 'WID-1', stock: 50 });
    productId = res.body.product.id;
  });

  it('rejects a duplicate SKU', async () => {
    const res = await adminAgent
      .post('/api/v1/products')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Widget 2', sku: 'WID-1', price: 5 })
      .expect(409);
    expect(res.body.message).toBe('A product with this SKU already exists');
  });

  it('lists products', async () => {
    const res = await adminAgent.get('/api/v1/products').expect(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.some((p) => p.id === productId)).toBe(true);
  });

  it('gets a single product', async () => {
    const res = await adminAgent.get(`/api/v1/products/${productId}`).expect(200);
    expect(res.body.product.sku).toBe('WID-1');
  });

  it('404s for a non-existent product', async () => {
    await adminAgent.get('/api/v1/products/999999').expect(404);
  });

  it('updates a product', async () => {
    const res = await adminAgent
      .patch(`/api/v1/products/${productId}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ price: 12.5 })
      .expect(200);
    expect(Number(res.body.product.price)).toBe(12.5);
  });

  it('denies a member (lacks products:delete) from deleting a product', async () => {
    const memberAgent = request.agent(app);
    const loginRes = await memberAgent
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: member.password })
      .expect(200);
    const memberCsrf = getCsrfToken(loginRes);

    await memberAgent
      .delete(`/api/v1/products/${productId}`)
      .set('X-CSRF-Token', memberCsrf)
      .expect(403);
  });

  it('deletes a product', async () => {
    await adminAgent
      .delete(`/api/v1/products/${productId}`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(204);

    await adminAgent.get(`/api/v1/products/${productId}`).expect(404);
  });
});
