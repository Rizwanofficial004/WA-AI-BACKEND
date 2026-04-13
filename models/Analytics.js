const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  // Conversation stats
  conversations: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    resolved: { type: Number, default: 0 },
    botHandled: { type: Number, default: 0 },
    agentHandled: { type: Number, default: 0 },
    handoffs: { type: Number, default: 0 }
  },
  // Message stats
  messages: {
    total: { type: Number, default: 0 },
    incoming: { type: Number, default: 0 },
    outgoing: { type: Number, default: 0 },
    fromBot: { type: Number, default: 0 },
    fromAgent: { type: Number, default: 0 },
    fromCustomer: { type: Number, default: 0 }
  },
  // Response time stats (in seconds)
  responseTime: {
    average: { type: Number, default: 0 },
    median: { type: Number, default: 0 },
    firstResponse: { type: Number, default: 0 }
  },
  // Lead stats
  leads: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
    qualified: { type: Number, default: 0 }
  },
  // Order stats
  orders: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    confirmed: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 }
  },
  // AI stats
  ai: {
    queries: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    averageTokens: { type: Number, default: 0 }
  },
  // Broadcast stats
  broadcasts: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 }
  },
  // Agent performance
  agentStats: [{
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
    },
    chatsHandled: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    satisfactionRating: { type: Number, default: 0 }
  }],
  // Hourly breakdown
  hourlyBreakdown: [{
    hour: Number, // 0-23
    messages: Number,
    conversations: Number,
    leads: Number
  }]
}, {
  timestamps: true
});

// Compound index for unique business + date
analyticsSchema.index({ business: 1, date: 1 }, { unique: true });
analyticsSchema.index({ business: 1, date: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
