const productService = require('../services/productService');

// @desc    Get all products for a business
// @route   GET /api/businesses/:businessId/products
const getProducts = async (req, res, next) => {
  try {
    const { category, brand, search, page, limit } = req.query;
    const result = await productService.getProducts(req.params.businessId, {
      category, brand, search, 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 20
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/businesses/:businessId/products/:productId
const getProduct = async (req, res, next) => {
  try {
    const product = await productService.getProduct(req.params.productId, req.params.businessId);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/businesses/:businessId/products
const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.params.businessId, req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/businesses/:businessId/products/:productId
const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.productId, req.params.businessId, req.body);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/businesses/:businessId/products/:productId
const deleteProduct = async (req, res, next) => {
  try {
    const result = await productService.deleteProduct(req.params.productId, req.params.businessId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Get brands
// @route   GET /api/businesses/:businessId/products/brands
const getBrands = async (req, res, next) => {
  try {
    const brands = await productService.getBrands(req.params.businessId);
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

// @desc    Get categories
// @route   GET /api/businesses/:businessId/products/categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await productService.getCategories(req.params.businessId);
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getBrands,
  getCategories
};