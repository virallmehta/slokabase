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

describe('Example Sales module — /api/v1/example-sales', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  let adminAgent;
  let adminCsrf;
  let productId;
  let saleId;

  beforeAll(async () => {
    await resetDatabase();

    adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/v1/auth/login').send(adminCredentials).expect(200);
    adminCsrf = getCsrfToken(loginRes);

    const productRes = await adminAgent
      .post('/api/v1/example-products')
      .set('X-CSRF-Token', adminCsrf)
      .send({ name: 'Gadget', sku: 'GAD-1', price: 20, stock: 10 })
      .expect(201);
    productId = productRes.body.product.id;
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/v1/example-sales').expect(401);
  });

  it('rejects a sale for more than the available stock', async () => {
    const res = await adminAgent
      .post('/api/v1/example-sales')
      .set('X-CSRF-Token', adminCsrf)
      .send({ productId, quantity: 999, unitPrice: 20 })
      .expect(400);
    expect(res.body.message).toBe('Insufficient stock for this sale');
  });

  it('creates a sale and decrements product stock', async () => {
    const res = await adminAgent
      .post('/api/v1/example-sales')
      .set('X-CSRF-Token', adminCsrf)
      .send({ productId, quantity: 3, unitPrice: 20 })
      .expect(201);

    expect(res.body.sale).toMatchObject({ product_id: productId, quantity: 3 });
    expect(Number(res.body.sale.total)).toBe(60);
    saleId = res.body.sale.id;

    const product = await db('example_products').where({ id: productId }).first();
    expect(product.stock).toBe(7);
  });

  it('lists sales', async () => {
    const res = await adminAgent.get('/api/v1/example-sales').expect(200);
    expect(res.body.sales.some((s) => s.id === saleId)).toBe(true);
  });

  it('gets a single sale', async () => {
    const res = await adminAgent.get(`/api/v1/example-sales/${saleId}`).expect(200);
    expect(res.body.sale.product_name).toBe('Gadget');
  });

  it('updates a sale quantity and re-adjusts stock', async () => {
    const res = await adminAgent
      .patch(`/api/v1/example-sales/${saleId}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ quantity: 5 })
      .expect(200);
    expect(res.body.sale.quantity).toBe(5);

    const product = await db('example_products').where({ id: productId }).first();
    expect(product.stock).toBe(5); // 7 + 3 (reverted) - 5
  });

  it('deletes a sale and restores stock', async () => {
    await adminAgent.delete(`/api/v1/example-sales/${saleId}`).set('X-CSRF-Token', adminCsrf).expect(204);

    const product = await db('example_products').where({ id: productId }).first();
    expect(product.stock).toBe(10);

    await adminAgent.get(`/api/v1/example-sales/${saleId}`).expect(404);
  });
});
