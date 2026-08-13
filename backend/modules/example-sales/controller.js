import { saleRepository } from './repository.js';
import { productRepository } from '../example-products/repository.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

export const listSales = asyncHandler(async (req, res) => {
  const sales = await saleRepository.findAll();
  res.json({ sales });
});

export const getSale = asyncHandler(async (req, res) => {
  const sale = await saleRepository.findById(req.params.id);
  if (!sale) throw ApiError.notFound('Sale not found');
  res.json({ sale });
});

export const createSale = asyncHandler(async (req, res) => {
  const { productId, quantity, unitPrice } = req.body;

  const product = await productRepository.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');
  if (product.stock < quantity) throw ApiError.badRequest('Insufficient stock for this sale');

  const sale = await saleRepository.create({
    productId,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    createdBy: req.user.id,
  });
  await productRepository.update(productId, { stock: product.stock - quantity });

  res.status(201).json({ sale });
});

export const updateSale = asyncHandler(async (req, res) => {
  const existing = await saleRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Sale not found');

  const quantity = req.body.quantity ?? existing.quantity;
  const unitPrice = req.body.unitPrice ?? existing.unit_price;

  if (req.body.quantity !== undefined) {
    const product = await productRepository.findById(existing.product_id);
    const stockAfterRevert = product.stock + existing.quantity;
    if (stockAfterRevert < quantity) throw ApiError.badRequest('Insufficient stock for this sale');
    await productRepository.update(existing.product_id, { stock: stockAfterRevert - quantity });
  }

  const sale = await saleRepository.update(req.params.id, {
    quantity,
    unit_price: unitPrice,
    total: quantity * unitPrice,
  });
  res.json({ sale });
});

export const deleteSale = asyncHandler(async (req, res) => {
  const existing = await saleRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Sale not found');

  const product = await productRepository.findById(existing.product_id);
  if (product) await productRepository.update(existing.product_id, { stock: product.stock + existing.quantity });

  await saleRepository.remove(req.params.id);
  res.status(204).send();
});
