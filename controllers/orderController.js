const { orderService } = require('../services');

// @desc    Create order
// @route   POST /api/businesses/:businessId/orders
// @access  Private
const createOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.body, req.params.businessId);
    
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders for a business
// @route   GET /api/businesses/:businessId/orders
// @access  Private
const getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    let orders;
    if (status) {
      orders = await orderService.getOrdersByStatus(req.params.businessId, status);
    } else {
      orders = await orderService.getOrdersByBusiness(req.params.businessId, options);
    }
    
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/businesses/:businessId/orders/:orderId
// @access  Private
const getOrder = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.orderId, req.params.businessId);
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/businesses/:businessId/orders/:orderId/status
// @access  Private
const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(
      req.params.orderId,
      req.params.businessId,
      req.body.status
    );
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order
// @route   PUT /api/businesses/:businessId/orders/:orderId
// @access  Private
const updateOrder = async (req, res, next) => {
  try {
    const order = await orderService.updateOrder(
      req.params.orderId,
      req.params.businessId,
      req.body
    );
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete order
// @route   DELETE /api/businesses/:businessId/orders/:orderId
// @access  Private
const deleteOrder = async (req, res, next) => {
  try {
    const result = await orderService.deleteOrder(req.params.orderId, req.params.businessId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order stats
// @route   GET /api/businesses/:businessId/orders/stats
// @access  Private
const getOrderStats = async (req, res, next) => {
  try {
    const stats = await orderService.getOrderStats(req.params.businessId);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getOrderStats
};