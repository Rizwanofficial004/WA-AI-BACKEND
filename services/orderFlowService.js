// Order Flow State Machine
// Manages step-by-step ordering process

const ORDER_STATES = {
  IDLE: 'idle',
  SELECTING_PRODUCT: 'selecting_product',
  SELECTING_SIZE: 'selecting_size',
  SELECTING_COLOR: 'selecting_color',
  ENTERING_QUANTITY: 'entering_quantity',
  CONFIRMING: 'confirming',
  COLLECTING_ADDRESS: 'collecting_address',
  COLLECTING_NAME: 'collecting_name',
  COLLECTING_PHONE: 'collecting_phone',
  COMPLETED: 'completed'
};

class OrderFlowService {
  constructor() {
    // In-memory store for order sessions (in production, use Redis)
    this.sessions = new Map();
  }

  // Get or create session for a customer
  getSession(businessId, customerPhone) {
    const key = `${businessId}:${customerPhone}`;
    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        state: ORDER_STATES.IDLE,
        businessId,
        customerPhone,
        order: {
          items: [],
          customerName: null,
          customerPhone: customerPhone,
          address: null,
          notes: ''
        },
        selectedProduct: null,
        availableSizes: [],
        availableColors: [],
        createdAt: new Date()
      });
    }
    return this.sessions.get(key);
  }

  // Clear session
  clearSession(businessId, customerPhone) {
    const key = `${businessId}:${customerPhone}`;
    this.sessions.delete(key);
  }

  // Update session state
  updateState(businessId, customerPhone, state) {
    const session = this.getSession(businessId, customerPhone);
    session.state = state;
    return session;
  }

  // Get current state
  getState(businessId, customerPhone) {
    const session = this.getSession(businessId, customerPhone);
    return session.state;
  }

  // Check if customer is in order flow
  isInOrderFlow(businessId, customerPhone) {
    const state = this.getState(businessId, customerPhone);
    return state !== ORDER_STATES.IDLE && state !== ORDER_STATES.COMPLETED;
  }

  // Start order flow with a product
  startOrder(businessId, customerPhone, product) {
    const session = this.getSession(businessId, customerPhone);
    session.selectedProduct = product;
    session.order.items = [{
      product: product._id,
      productName: product.name,
      brand: product.brand || '',
      price: product.price,
      quantity: 1,
      size: null,
      color: null
    }];

    // Check what options product has
    if (product.sizes?.length > 0) {
      session.availableSizes = product.sizes;
      session.state = ORDER_STATES.SELECTING_SIZE;
    } else if (product.colors?.length > 0) {
      session.availableColors = product.colors;
      session.state = ORDER_STATES.SELECTING_COLOR;
    } else {
      session.state = ORDER_STATES.ENTERING_QUANTITY;
    }

    return session;
  }

  // Process user input based on current state
  processInput(businessId, customerPhone, input) {
    const session = this.getSession(businessId, customerPhone);
    
    switch (session.state) {
      case ORDER_STATES.SELECTING_SIZE:
        return this.handleSizeSelection(session, input);
      
      case ORDER_STATES.SELECTING_COLOR:
        return this.handleColorSelection(session, input);
      
      case ORDER_STATES.ENTERING_QUANTITY:
        return this.handleQuantityInput(session, input);
      
      case ORDER_STATES.COLLECTING_NAME:
        return this.handleNameInput(session, input);
      
      case ORDER_STATES.COLLECTING_ADDRESS:
        return this.handleAddressInput(session, input);
      
      case ORDER_STATES.CONFIRMING:
        return this.handleConfirmation(session, input);
      
      default:
        return { session, response: null };
    }
  }

  handleSizeSelection(session, input) {
    const size = input.trim().toUpperCase();
    const availableSize = session.availableSizes.find(
      s => s.size.toUpperCase() === size || s.size === input.trim()
    );

    if (availableSize) {
      session.order.items[0].size = availableSize.size;
      
      // Move to color selection or quantity
      if (session.selectedProduct.colors?.length > 0) {
        session.availableColors = session.selectedProduct.colors;
        session.state = ORDER_STATES.SELECTING_COLOR;
      } else {
        session.state = ORDER_STATES.ENTERING_QUANTITY;
      }
    }

    return { session, response: null };
  }

  handleColorSelection(session, input) {
    const color = input.trim().toLowerCase();
    const availableColor = session.availableColors.find(
      c => c.name.toLowerCase() === color
    );

    if (availableColor) {
      session.order.items[0].color = availableColor.name;
    }

    session.state = ORDER_STATES.ENTERING_QUANTITY;
    return { session, response: null };
  }

  handleQuantityInput(session, input) {
    const quantity = parseInt(input.trim());
    
    if (quantity > 0 && quantity <= 100) {
      session.order.items[0].quantity = quantity;
      session.state = ORDER_STATES.COLLECTING_NAME;
    }

    return { session, response: null };
  }

  handleNameInput(session, input) {
    if (input.trim().length >= 2) {
      session.order.customerName = input.trim();
      session.state = ORDER_STATES.COLLECTING_ADDRESS;
    }
    return { session, response: null };
  }

  handleAddressInput(session, input) {
    if (input.trim().length >= 10) {
      session.order.address = input.trim();
      session.state = ORDER_STATES.CONFIRMING;
    }
    return { session, response: null };
  }

  handleConfirmation(session, input) {
    const confirmWords = ['yes', 'haan', 'confirm', 'ha', 'ji', '✓', 'confirm karo'];
    const isConfirmed = confirmWords.some(word => 
      input.toLowerCase().includes(word)
    );

    if (isConfirmed) {
      session.state = ORDER_STATES.COMPLETED;
    } else {
      session.state = ORDER_STATES.IDLE;
    }

    return { session, response: null, confirmed: isConfirmed };
  }

  // Get formatted order summary
  getOrderSummary(session) {
    const item = session.order.items[0];
    const total = item.price * item.quantity;

    let summary = `*📦 ORDER SUMMARY*\n`;
    summary += `━━━━━━━━━━━━━━━━\n\n`;
    summary += `*Product:* ${item.productName}\n`;
    if (item.brand) summary += `*Brand:* ${item.brand}\n`;
    if (item.size) summary += `*Size:* ${item.size}\n`;
    if (item.color) summary += `*Color:* ${item.color}\n`;
    summary += `*Quantity:* ${item.quantity}\n`;
    summary += `*Price:* PKR ${item.price.toLocaleString()} x ${item.quantity}\n`;
    summary += `━━━━━━━━━━━━━━━━\n`;
    summary += `*Total: PKR ${total.toLocaleString()}*\n\n`;
    
    if (session.order.customerName) {
      summary += `👤 *Name:* ${session.order.customerName}\n`;
    }
    if (session.order.address) {
      summary += `📍 *Address:* ${session.order.address}\n`;
    }

    return summary;
  }

  // Check for quick reply responses
  isQuickReply(input, options) {
    const normalizedInput = input.trim().toLowerCase();
    return options.some(opt => 
      normalizedInput === opt.toLowerCase() || 
      normalizedInput === opt.toLowerCase().replace(/\s+/g, '')
    );
  }
}

module.exports = new OrderFlowService();
module.exports.ORDER_STATES = ORDER_STATES;