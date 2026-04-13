const express = require('express');
const router = express.Router();
const { productController } = require('../controllers');
const { protect, checkBusinessAccess, checkBusinessOwnership } = require('../middlewares');

// Product routes
// View - both owner and agent
router.get('/:businessId/products', protect, checkBusinessAccess, productController.getProducts);
router.get('/:businessId/products/brands', protect, checkBusinessAccess, productController.getBrands);
router.get('/:businessId/products/categories', protect, checkBusinessAccess, productController.getCategories);
router.get('/:businessId/products/:productId', protect, checkBusinessAccess, productController.getProduct);

// CRUD - owner only
router.post('/:businessId/products', protect, checkBusinessOwnership, productController.createProduct);
router.put('/:businessId/products/:productId', protect, checkBusinessOwnership, productController.updateProduct);
router.delete('/:businessId/products/:productId', protect, checkBusinessOwnership, productController.deleteProduct);

module.exports = router;