const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  category: {
    type: String,
    enum: ['faq', 'product', 'policy', 'general', 'custom'],
    default: 'general'
  },
  embedding: {
    type: [Number],
    default: []
  },
  metadata: {
    source: String,
    filename: String,
    filetype: String,
    chunks: [{
      content: String,
      embedding: [Number],
      index: Number
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for business queries
knowledgeBaseSchema.index({ business: 1, category: 1 });
knowledgeBaseSchema.index({ business: 1, isActive: 1 });

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);