import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '#db/knex.js';
import { resetDatabase } from './testDb.js';

describe('GET /api/menu', () => {
  const adminCredentials = {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };
  const member = {
    name: 'Menu Member',
    email: 'menu-member@example.com',
    password: 'memberpassword123',
  };

  beforeAll(async () => {
    await resetDatabase();
    await request(app).post('/api/v1/auth/register').send(member).expect(201);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/menu').expect(401);
  });

  it('returns the full, group/order-sorted menu tree for admin (all permissions)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send(adminCredentials).expect(200);

    const res = await agent.get('/api/menu').expect(200);
    expect(res.body.menu).toEqual([
      {
        group: 'Administration',
        items: [
          expect.objectContaining({ key: 'audit-log', label: 'Audit Log', order: 20 }),
          expect.objectContaining({ key: 'roles', label: 'Roles', order: 30 }),
          expect.objectContaining({ key: 'settings', label: 'Settings', order: 40 }),
        ],
      },
      {
        group: 'Catalog',
        items: [
          expect.objectContaining({ key: 'example-products', label: 'Example Products', order: 10 }),
          expect.objectContaining({ key: 'example-sales', label: 'Example Sales', order: 20 }),
        ],
      },
    ]);
  });

  it('returns an empty menu for a member with no module permissions', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: member.password })
      .expect(200);

    const res = await agent.get('/api/menu').expect(200);
    expect(res.body.menu).toEqual([]);
  });

  it('includes the Roles and Settings menu entries for a demo-role user', async () => {
    const demoCredentials = {
      email: process.env.SEED_DEMO_EMAIL || 'demo@example.com',
      password: process.env.SEED_DEMO_PASSWORD || 'DemoOnly123!',
    };

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send(demoCredentials).expect(200);

    const res = await agent.get('/api/menu').expect(200);
    const administrationGroup = res.body.menu.find((group) => group.group === 'Administration');
    const itemKeys = administrationGroup.items.map((item) => item.key);
    expect(itemKeys).toContain('roles');
    expect(itemKeys).toContain('settings');
  });

  it('only shows menu items the caller holds the requiredPermission for', async () => {
    const memberRole = await db('roles').where({ key: 'member' }).first();
    const productsRead = await db('permissions').where({ key: 'example-products:read' }).first();
    await db('role_permissions').insert({ role_id: memberRole.id, permission_id: productsRead.id });

    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: member.password })
      .expect(200);

    const res = await agent.get('/api/menu').expect(200);
    expect(res.body.menu).toEqual([
      {
        group: 'Catalog',
        items: [expect.objectContaining({ key: 'example-products' })],
      },
    ]);
  });
});
