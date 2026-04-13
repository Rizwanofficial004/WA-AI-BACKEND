const mongoose = require('mongoose');

const chatTagSchema = new mongoose.Schema({
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
  color: {
    type: String,
    default: '#3B82F6'
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['priority', 'status', 'topic', 'custom'],
    default: 'custom'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  }
}, {
  timestamps: true
});

// Indexes
chatTagSchema.index({ business: 1, name: 1 }, { unique: true });
chatTagSchema.index({ business: 1, category: 1 });
chatTagSchema.index({ business: 1, isActive: 1 });

module.exports = mongoose.model('ChatTag', chatTagSchema);
