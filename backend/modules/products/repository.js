import { db } from '#db/knex.js';

export const productRepository = {
  findAll: () => db('products').select('*').orderBy('id'),

  findById: (id) => db('products').where({ id }).first(),

  findBySku: (sku) => db('products').where({ sku }).first(),

  create: async ({ name, sku, description = null, price, stock = 0 }) => {
    const [id] = await db('products').insert({ name, sku, description, price, stock });
    return productRepository.findById(id);
  },

  update: async (id, fields) => {
    await db('products')
      .where({ id })
      .update({ ...fields, updated_at: db.fn.now() });
    return productRepository.findById(id);
  },

  remove: (id) => db('products').where({ id }).del(),
};
