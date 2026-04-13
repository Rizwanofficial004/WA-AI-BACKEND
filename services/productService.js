const { Product } = require('../models');

class ProductService {
  // Get all products for a business
  async getProducts(businessId, options = {}) {
    const { category, brand, search, page = 1, limit = 20 } = options;
    
    const query = { business: businessId, isActive: true };
    
    if (category) query.category = category;
    if (brand) query.brand = new RegExp(brand, 'i');
    if (search) {
      query.$text = { $search: search };
    }

    const products = await Product.find(query)
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(query);

    return { products, total, page, pages: Math.ceil(total / limit) };
  }

  // Get single product
  async getProduct(productId, businessId) {
    const product = await Product.findOne({ _id: productId, business: businessId });
    if (!product) throw new Error('Product not found');
    return product;
  }

  // Create product
  async createProduct(businessId, productData) {
    return await Product.create({ ...productData, business: businessId });
  }

  // Update product
  async updateProduct(productId, businessId, updateData) {
    const product = await Product.findOneAndUpdate(
      { _id: productId, business: businessId },
      updateData,
      { new: true, runValidators: true }
    );
    if (!product) throw new Error('Product not found');
    return product;
  }

  // Delete product
  async deleteProduct(productId, businessId) {
    const product = await Product.findOneAndDelete({ _id: productId, business: businessId });
    if (!product) throw new Error('Product not found');
    return { message: 'Product deleted successfully' };
  }

  // Search products by description (AI-powered)
  async searchProducts(businessId, query) {
    const products = await Product.find({
      business: businessId,
      isActive: true,
      $text: { $search: query }
    }).limit(5);

    return products;
  }

  // Find products by criteria from AI
  async findProductsByCriteria(businessId, criteria) {
    const query = { business: businessId, isActive: true };

    if (criteria.brand) {
      query.brand = new RegExp(criteria.brand, 'i');
    }
    if (criteria.category) {
      query.category = new RegExp(criteria.category, 'i');
    }
    if (criteria.color) {
      query['colors.name'] = new RegExp(criteria.color, 'i');
    }
    if (criteria.size) {
      query['sizes.size'] = criteria.size;
    }
    if (criteria.maxPrice) {
      query.price = { ...query.price, $lte: criteria.maxPrice };
    }
    if (criteria.minPrice) {
      query.price = { ...query.price, $gte: criteria.minPrice };
    }

    const products = await Product.find(query).limit(5);
    return products;
  }

  // Get product variants (sizes/colors) for WhatsApp response
  formatProductForWhatsApp(product) {
    let message = `*${product.name}*\n`;
    if (product.brand) message += `Brand: ${product.brand}\n`;
    message += `Price: PKR ${product.price.toLocaleString()}\n`;
    
    if (product.sizes?.length > 0) {
      message += `\nSizes: ${product.sizes.map(s => s.size).join(', ')}`;
    }
    
    if (product.colors?.length > 0) {
      message += `\nColors: ${product.colors.map(c => c.name).join(', ')}`;
    }

    if (product.images?.length > 0) {
      message += `\n\nImages available: ${product.images.length} images`;
    }

    return message;
  }

  // Get all brands for a business
  async getBrands(businessId) {
    return await Product.distinct('brand', { business: businessId, isActive: true });
  }

  // Get all categories for a business
  async getCategories(businessId) {
    return await Product.distinct('category', { business: businessId, isActive: true });
  }
}

module.exports = new ProductService();