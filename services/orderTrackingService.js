// Order Tracking Service
// Handles order status lookup and updates

const { Order } = require('../models');

class OrderTrackingService {
  
  // Check if message is an order tracking request
  isTrackingRequest(message) {
    const trackingKeywords = [
      'track', 'track order', 'order status', 'order kahan hai',
      'delivery status', 'kab aayega', 'where is my order',
      'order update', 'shipment', 'parcel', 'package'
    ];
    
    const lowerMessage = message.toLowerCase().trim();
    
    // Check for tracking keywords
    const hasTrackingKeyword = trackingKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // Check if it looks like an order ID (6-8 alphanumeric characters)
    const orderIdPattern = /^[A-Z0-9]{6,12}$/i;
    const isOrderId = orderIdPattern.test(message.trim());
    
    // Check for # prefixed order ID
    const hasOrderHash = message.includes('#') && /#[A-Z0-9]{6,12}/i.test(message);
    
    return hasTrackingKeyword || isOrderId || hasOrderHash;
  }

  // Extract order ID from message
  extractOrderId(message) {
    // First check for # prefixed order ID (e.g., #90C15845)
    const hashMatch = message.match(/#([A-Z0-9]{6,12})/i);
    if (hashMatch) {
      return hashMatch[1].toUpperCase();
    }
    
    // Check for standalone order ID (e.g., 90C15845 or FEED4562)
    const standaloneMatch = message.match(/\b([A-Z0-9]{6,12})\b/i);
    if (standaloneMatch) {
      // Make sure it's not just random text - check if it looks like an order ID
      // Order IDs are typically alphanumeric with numbers
      const candidate = standaloneMatch[1];
      if (/\d/.test(candidate)) { // Must contain at least one number
        return candidate.toUpperCase();
      }
    }
    
    // Check for "order" followed by ID
    const orderMatch = message.match(/order\s*(?:#)?([A-Z0-9]{6,12})/i);
    if (orderMatch) {
      return orderMatch[1].toUpperCase();
    }
    
    // Check for "track" followed by ID
    const trackMatch = message.match(/track\s*(?:#)?([A-Z0-9]{6,12})/i);
    if (trackMatch) {
      return trackMatch[1].toUpperCase();
    }
    
    return null;
  }

  // Find order by ID (searches in last 6-8 characters)
  async findOrder(orderId) {
    try {
      // First try exact match with _id
      let order = await Order.findById(orderId).populate('business');
      
      if (!order) {
        // Use the full orderId provided (customer sees last 8 chars)
        const searchId = orderId.toUpperCase();
        
        // Search in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        // Try matching end of MongoDB _id (case insensitive)
        order = await Order.findOne({
          _id: { $regex: new RegExp(searchId + '$', 'i') },
          createdAt: { $gte: thirtyDaysAgo }
        }).populate('business');
        
        // If not found with full ID, try last 6 chars as fallback
        if (!order && searchId.length > 6) {
          const shortId = searchId.slice(-6);
          order = await Order.findOne({
            _id: { $regex: new RegExp(shortId + '$', 'i') },
            createdAt: { $gte: thirtyDaysAgo }
          }).populate('business');
        }
      }
      
      return order;
    } catch (error) {
      console.error('Error finding order:', error);
      return null;
    }
  }

  // Get order status emoji
  getStatusEmoji(status) {
    const statusEmojis = {
      'pending': '⏳',
      'confirmed': '✅',
      'processing': '⚙️',
      'shipped': '🚚',
      'delivered': '📦',
      'cancelled': '❌'
    };
    return statusEmojis[status] || '📋';
  }

  // Get order status in Urdu/English
  getStatusText(status) {
    const statusTexts = {
      'pending': 'Pending - Abhi confirm hone ka wait kar raha hai',
      'confirmed': 'Confirmed - Order confirm ho gaya hai',
      'processing': 'Processing - Order pack ho raha hai',
      'shipped': 'Shipped - Order dispatch ho gaya hai',
      'delivered': 'Delivered - Order deliver ho gaya hai',
      'cancelled': 'Cancelled - Order cancel kar diya gaya'
    };
    return statusTexts[status] || 'Unknown status';
  }

  // Create order tracking message
  createTrackingMessage(order) {
    const emoji = this.getStatusEmoji(order.status);
    const statusText = this.getStatusText(order.status);
    
    let message = `${emoji} *ORDER TRACKING*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📦 *Order ID:* #${order._id.slice(-8).toUpperCase()}\n`;
    message += `📅 *Date:* ${new Date(order.createdAt).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })}\n\n`;
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 *Order Items:*\n`;
    order.items.forEach(item => {
      message += `   • ${item.productName}`;
      if (item.size) message += ` (${item.size})`;
      if (item.color) message += ` - ${item.color}`;
      message += ` x ${item.quantity}\n`;
    });
    
    message += `\n💰 *Total:* PKR ${order.totalAmount.toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    message += `📊 *Current Status:*\n`;
    message += `${emoji} ${statusText}\n\n`;
    
    // Order timeline
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📍 *Order Timeline:*\n\n`;
    message += this.createOrderTimeline(order.status);
    
    if (order.shippingAddress?.fullAddress) {
      message += `\n📍 *Delivery Address:*\n${order.shippingAddress.fullAddress}\n`;
    }
    
    if (order.customerName) {
      message += `\n👤 *Customer:* ${order.customerName}\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📞 *Koi sawal ho toh humein contact karein!*`;

    return message;
  }

  // Create visual order timeline
  createOrderTimeline(currentStatus) {
    const steps = [
      { key: 'pending', label: 'Order Placed', emoji: '📝' },
      { key: 'confirmed', label: 'Confirmed', emoji: '✅' },
      { key: 'processing', label: 'Processing', emoji: '⚙️' },
      { key: 'shipped', label: 'Shipped', emoji: '🚚' },
      { key: 'delivered', label: 'Delivered', emoji: '📦' }
    ];

    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    
    let timeline = '';
    
    steps.forEach((step, index) => {
      if (index <= currentIndex) {
        timeline += `${step.emoji} ${step.label}\n`;
      } else {
        timeline += `⬜ ${step.label}\n`;
      }
    });

    if (currentStatus === 'cancelled') {
      timeline = `❌ Order Cancelled\n`;
    }

    return timeline;
  }

  // Get recent orders for a customer
  async getCustomerOrders(businessId, customerPhone, limit = 5) {
    try {
      const orders = await Order.find({
        business: businessId,
        customerPhone: customerPhone
      })
      .sort({ createdAt: -1 })
      .limit(limit);
      
      return orders;
    } catch (error) {
      console.error('Error getting customer orders:', error);
      return [];
    }
  }

  // Create recent orders list message
  async createRecentOrdersMessage(businessId, customerPhone) {
    const orders = await this.getCustomerOrders(businessId, customerPhone, 5);
    
    if (orders.length === 0) {
      return null;
    }

    let message = `📋 *Aapke Recent Orders:*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    orders.forEach((order, index) => {
      const emoji = this.getStatusEmoji(order.status);
      message += `${index + 1}. ${emoji} *#${order._id.slice(-8).toUpperCase()}*\n`;
      message += `   📅 ${new Date(order.createdAt).toLocaleDateString()}\n`;
      message += `   💰 PKR ${order.totalAmount.toLocaleString()}\n`;
      message += `   📊 ${order.status}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `Tracking ke liye Order ID bhejein\n`;
    message += `Example: #${orders[0]._id.slice(-8).toUpperCase()}`;

    return message;
  }

  // Handle quick reply for order status buttons
  createOrderStatusButtons(orderId) {
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        header: { type: 'text', text: '📍 Track Order' },
        body: { text: `Order ID: *#${orderId.slice(-8).toUpperCase()}*\n\nKya janna chahte hain?` },
        footer: { text: 'Select an option' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `status_${orderId}`, title: '📊 Current Status' } },
            { type: 'reply', reply: { id: `timeline_${orderId}`, title: '📍 Order Timeline' } },
            { type: 'reply', reply: { id: 'recent_orders', title: '📋 Recent Orders' } }
          ]
        }
      }
    };
  };
}

module.exports = new OrderTrackingService();