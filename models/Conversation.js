const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
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
  customerProfilePic: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'pending', 'archived'],
    default: 'active'
  },
  // Agent assignment for team inbox
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  },
  assignedAt: {
    type: Date
  },
  // Conversation handoff
  isBotActive: {
    type: Boolean,
    default: true
  },
  handoffRequested: {
    type: Boolean,
    default: false
  },
  handoffReason: {
    type: String,
    enum: ['customer_request', 'complex_query', 'complaint', 'manual', 'timeout', null],
    default: null
  },
  handoffRequestedAt: {
    type: Date
  },
  // Conversation state for automation
  state: {
    type: String,
    default: 'idle'
  },
  stateData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Channel info
  channel: {
    type: String,
    enum: ['whatsapp', 'web', 'api'],
    default: 'whatsapp'
  },
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  // Unread count for agent
  unreadCount: {
    type: Number,
    default: 0
  },
  // Last customer message (for preview)
  lastCustomerMessage: {
    type: String
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  lastMessageBy: {
    type: String,
    enum: ['customer', 'ai', 'agent'],
    default: 'customer'
  },
  messageCount: {
    type: Number,
    default: 0
  },
  tags: [{
    name: String,
    color: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: [{
    content: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // First response time tracking
  firstResponseTime: {
    type: Number // in seconds
  },
  // Satisfaction rating
  satisfactionRating: {
    type: Number,
    min: 1,
    max: 5
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for faster queries
conversationSchema.index({ business: 1, customerPhone: 1 });
conversationSchema.index({ business: 1, status: 1 });
conversationSchema.index({ business: 1, assignedAgent: 1 });
conversationSchema.index({ business: 1, handoffRequested: 1 });
conversationSchema.index({ business: 1, isBotActive: 1 });
conversationSchema.index({ business: 1, lastMessageAt: -1 });
conversationSchema.index({ business: 1, 'tags.name': 1 });
conversationSchema.index({ business: 1, priority: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
