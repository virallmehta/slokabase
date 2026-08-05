import { db } from '#db/knex.js';

const PUBLIC_COLUMNS = [
  'sales.id',
  'sales.product_id',
  'products.name as product_name',
  'sales.quantity',
  'sales.unit_price',
  'sales.total',
  'sales.sold_at',
  'sales.created_by',
  'sales.created_at',
];

export const saleRepository = {
  findAll: () =>
    db('sales').join('products', 'products.id', 'sales.product_id').select(PUBLIC_COLUMNS).orderBy('sales.id'),

  findById: (id) =>
    db('sales')
      .join('products', 'products.id', 'sales.product_id')
      .select(PUBLIC_COLUMNS)
      .where('sales.id', id)
      .first(),

  // Powers the Users module's "Related records" panel (core reaches into
  // this module for it — see user.controller.js's getUserRelatedSales).
  findByCreatedBy: (userId) =>
    db('sales')
      .join('products', 'products.id', 'sales.product_id')
      .select(PUBLIC_COLUMNS)
      .where('sales.created_by', userId)
      .orderBy('sales.created_at', 'desc'),

  create: async ({ productId, quantity, unitPrice, total, createdBy = null }) => {
    const [id] = await db('sales').insert({
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      total,
      created_by: createdBy,
    });
    return saleRepository.findById(id);
  },

  update: async (id, fields) => {
    await db('sales')
      .where({ id })
      .update({ ...fields, updated_at: db.fn.now() });
    return saleRepository.findById(id);
  },

  remove: (id) => db('sales').where({ id }).del(),
};
