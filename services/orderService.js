const { OrderRepository } = require('../repositories');

class OrderService {
  constructor() {
    this.orderRepository = new OrderRepository();
  }

  async createOrder(orderData, businessId) {
    // Calculate total amount
    let totalAmount = 0;
    if (orderData.items && orderData.items.length > 0) {
      totalAmount = orderData.items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
    }

    const order = await this.orderRepository.create({
      business: businessId,
      ...orderData,
      totalAmount
    });

    return order;
  }

  async getOrderById(orderId, businessId) {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order || order.business.toString() !== businessId.toString()) {
      throw new Error('Order not found');
    }

    return order;
  }

  async getOrdersByBusiness(businessId, options = {}) {
    return await this.orderRepository.findByBusiness(businessId, options);
  }

  async getOrdersByCustomer(businessId, customerPhone) {
    return await this.orderRepository.findByCustomer(businessId, customerPhone);
  }

  async getOrdersByStatus(businessId, status) {
    return await this.orderRepository.findByStatus(businessId, status);
  }

  async updateOrderStatus(orderId, businessId, status) {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order || order.business.toString() !== businessId.toString()) {
      throw new Error('Order not found');
    }

    const updatedOrder = await this.orderRepository.updateById(orderId, { status });
    return updatedOrder;
  }

  async updateOrder(orderId, businessId, updateData) {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order || order.business.toString() !== businessId.toString()) {
      throw new Error('Order not found');
    }

    // Recalculate total if items are updated
    if (updateData.items) {
      updateData.totalAmount = updateData.items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
    }

    const updatedOrder = await this.orderRepository.updateById(orderId, updateData);
    return updatedOrder;
  }

  async deleteOrder(orderId, businessId) {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order || order.business.toString() !== businessId.toString()) {
      throw new Error('Order not found');
    }

    await this.orderRepository.deleteById(orderId);
    return { message: 'Order deleted successfully' };
  }

  async getOrderStats(businessId) {
    const orders = await this.orderRepository.findByBusiness(businessId);
    
    const stats = {
      total: orders.length,
      totalRevenue: 0,
      byStatus: {
        pending: 0,
        confirmed: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
      }
    };

    orders.forEach(order => {
      stats.byStatus[order.status]++;
      if (order.status !== 'cancelled') {
        stats.totalRevenue += order.totalAmount;
      }
    });

    return stats;
  }

  async parseOrderFromMessage(messageContent) {
    // Simple order parsing - in production, use AI to extract order details
    const orderItems = [];
    
    // Basic pattern matching for order items
    const patterns = [
      /(\d+)\s+(?:units?\s+of\s+)?([a-zA-Z\s]+)/gi,
      /buy\s+(\d+)\s+([a-zA-Z\s]+)/gi,
      /order\s+(\d+)\s+([a-zA-Z\s]+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(messageContent)) !== null) {
        const quantity = parseInt(match[1], 10);
        const product = match[2].trim();
        
        if (quantity > 0 && product.length > 2) {
          orderItems.push({
            productName: product,
            quantity,
            price: 0 // Price would need to be looked up from product catalog
          });
        }
      }
    }

    return orderItems;
  }
}

module.exports = new OrderService();