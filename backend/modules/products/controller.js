import { productRepository } from './repository.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

export const listProducts = asyncHandler(async (req, res) => {
  const products = await productRepository.findAll();
  res.json({ products });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await productRepository.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  res.json({ product });
});

export const createProduct = asyncHandler(async (req, res) => {
  const existing = await productRepository.findBySku(req.body.sku);
  if (existing) throw ApiError.conflict('A product with this SKU already exists');

  const product = await productRepository.create(req.body);
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const existing = await productRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Product not found');

  if (req.body.sku && req.body.sku !== existing.sku) {
    const skuOwner = await productRepository.findBySku(req.body.sku);
    if (skuOwner) throw ApiError.conflict('A product with this SKU already exists');
  }

  const product = await productRepository.update(req.params.id, req.body);
  res.json({ product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const existing = await productRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Product not found');

  await productRepository.remove(req.params.id);
  res.status(204).send();
});
