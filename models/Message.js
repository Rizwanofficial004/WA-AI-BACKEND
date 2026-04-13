const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  sender: {
    type: String,
    enum: ['customer', 'ai', 'agent'],
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'document', 'audio', 'video', 'location', 'interactive'],
    default: 'text'
  },
  metadata: {
    waMessageId: String,
    timestamp: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    }
  },
  isAIgenerated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ business: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);