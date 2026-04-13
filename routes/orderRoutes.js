const express = require('express');
const router = express.Router();
const { orderController } = require('../controllers');
const { protect, checkBusinessAccess, createOrderValidation } = require('../middlewares');

// Order routes (nested under business)
// Both owner and agent can access orders
router.post('/:businessId/orders', protect, checkBusinessAccess, createOrderValidation, orderController.createOrder);
router.get('/:businessId/orders', protect, checkBusinessAccess, orderController.getOrders);
router.get('/:businessId/orders/stats', protect, checkBusinessAccess, orderController.getOrderStats);
router.get('/:businessId/orders/:orderId', protect, checkBusinessAccess, orderController.getOrder);
router.put('/:businessId/orders/:orderId', protect, checkBusinessAccess, orderController.updateOrder);
router.put('/:businessId/orders/:orderId/status', protect, checkBusinessAccess, orderController.updateOrderStatus);
router.delete('/:businessId/orders/:orderId', protect, checkBusinessAccess, orderController.deleteOrder);

module.exports = router;