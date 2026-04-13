const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'draft'
  },
  // Message content
  message: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'template', 'image', 'document'],
    default: 'text'
  },
  // For template messages
  templateName: {
    type: String
  },
  templateLanguage: {
    type: String,
    default: 'en'
  },
  templateParams: {
    type: mongoose.Schema.Types.Mixed
  },
  // For image/document
  mediaUrl: {
    type: String
  },
  mediaCaption: {
    type: String
  },
  // Target audience
  target: {
    type: {
      type: String,
      enum: ['all', 'tag', 'segment', 'specific', 'leads', 'no_orders', 'inactive'],
      default: 'all'
    },
    tags: [String],
    segmentId: String,
    specificPhones: [String],
    inactiveDays: Number
  },
  // Scheduling
  scheduledAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  // Stats
  stats: {
    totalTargeted: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    failedReasons: [{
      phone: String,
      reason: String
    }]
  },
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  },
  // Tags for categorization
  tags: [String],
  // Rate limiting
  rateLimitPerMinute: {
    type: Number,
    default: 50
  }
}, {
  timestamps: true
});

// Indexes
broadcastSchema.index({ business: 1, status: 1 });
broadcastSchema.index({ business: 1, scheduledAt: 1 });
broadcastSchema.index({ business: 1, createdAt: -1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);
