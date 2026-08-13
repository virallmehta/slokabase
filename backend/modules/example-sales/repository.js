import { db } from '#db/knex.js';

const PUBLIC_COLUMNS = [
  'example_sales.id',
  'example_sales.product_id',
  'example_products.name as product_name',
  'example_sales.quantity',
  'example_sales.unit_price',
  'example_sales.total',
  'example_sales.sold_at',
  'example_sales.created_by',
  'example_sales.created_at',
];

export const saleRepository = {
  findAll: () =>
    db('example_sales')
      .join('example_products', 'example_products.id', 'example_sales.product_id')
      .select(PUBLIC_COLUMNS)
      .orderBy('example_sales.id'),

  findById: (id) =>
    db('example_sales')
      .join('example_products', 'example_products.id', 'example_sales.product_id')
      .select(PUBLIC_COLUMNS)
      .where('example_sales.id', id)
      .first(),

  // Powers the Users module's "Related records" panel (core reaches into
  // this module for it — see user.controller.js's getUserRelatedSales).
  findByCreatedBy: (userId) =>
    db('example_sales')
      .join('example_products', 'example_products.id', 'example_sales.product_id')
      .select(PUBLIC_COLUMNS)
      .where('example_sales.created_by', userId)
      .orderBy('example_sales.created_at', 'desc'),

  create: async ({ productId, quantity, unitPrice, total, createdBy = null }) => {
    const [id] = await db('example_sales').insert({
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      total,
      created_by: createdBy,
    });
    return saleRepository.findById(id);
  },

  update: async (id, fields) => {
    await db('example_sales')
      .where({ id })
      .update({ ...fields, updated_at: db.fn.now() });
    return saleRepository.findById(id);
  },

  remove: (id) => db('example_sales').where({ id }).del(),
};
