const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
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
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  source: {
    type: String,
    enum: ['whatsapp', 'web', 'referral'],
    default: 'whatsapp'
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new'
  },
  interest: {
    type: String,
    trim: true
  },
  notes: [{
    content: String,
    createdAt: { type: Date, default: Date.now }
  }],
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Index for business queries
leadSchema.index({ business: 1, status: 1 });
leadSchema.index({ business: 1, createdAt: -1 });
leadSchema.index({ customerPhone: 1, business: 1 });

module.exports = mongoose.model('Lead', leadSchema);