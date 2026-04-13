const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  brand: {
    type: String,
    trim: true,
    index: true
  },
  category: {
    type: String,
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  // For shoes/clothing
  sizes: [{
    size: String,
    stock: { type: Number, default: 0 }
  }],
  colors: [{
    name: String,
    code: String, // hex color code
    images: [String] // color-specific images
  }],
  // Searchable tags
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  // Embedding for AI search
  embedding: [Number],
  isActive: {
    type: Boolean,
    default: true
  },
  stock: {
    type: Number,
    default: 0
  },
  sku: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Text index for search
productSchema.index({ name: 'text', brand: 'text', description: 'text', tags: 'text' });
productSchema.index({ business: 1, isActive: 1 });
productSchema.index({ business: 1, brand: 1 });
productSchema.index({ business: 1, category: 1 });

module.exports = mongoose.model('Product', productSchema);