const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  customerPhone: {
    type: String,
    required: [true, 'Customer phone is required'],
    trim: true
  },
  customerName: {
    type: String,
    trim: true
  },
  items: [{
    productName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    notes: String
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    fullAddress: String
  },
  notes: {
    type: String,
    trim: true
  },
  orderSource: {
    type: String,
    enum: ['whatsapp', 'web', 'phone'],
    default: 'whatsapp'
  }
}, {
  timestamps: true
});

// Index for business queries
orderSchema.index({ business: 1, status: 1 });
orderSchema.index({ business: 1, createdAt: -1 });
orderSchema.index({ customerPhone: 1, business: 1 });

module.exports = mongoose.model('Order', orderSchema);