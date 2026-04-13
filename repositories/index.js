const { User, Business, Conversation, Message, KnowledgeBase, Order, Lead } = require('../models');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, populate = '') {
    let query = this.model.findById(id);
    if (populate) {
      query = query.populate(populate);
    }
    return await query;
  }

  async findOne(filter, populate = '') {
    let query = this.model.findOne(filter);
    if (populate) {
      query = query.populate(populate);
    }
    return await query;
  }

  async find(filter, options = {}) {
    let query = this.model.find(filter);
    
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.sort) {
      query = query.sort(options.sort);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.skip) {
      query = query.skip(options.skip);
    }
    
    return await query;
  }

  async create(data) {
    return await this.model.create(data);
  }

  async updateById(id, data) {
    return await this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async updateOne(filter, data) {
    return await this.model.findOneAndUpdate(filter, data, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return await this.model.findByIdAndDelete(id);
  }

  async deleteOne(filter) {
    return await this.model.findOneAndDelete(filter);
  }

  async count(filter = {}) {
    return await this.model.countDocuments(filter);
  }

  async aggregate(pipeline) {
    return await this.model.aggregate(pipeline);
  }
}

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    return await this.model.findOne({ email }).select('+password');
  }
}

class BusinessRepository extends BaseRepository {
  constructor() {
    super(Business);
  }

  async findByOwner(ownerId) {
    return await this.model.find({ owner: ownerId });
  }

  async findByWhatsAppNumber(whatsappNumber) {
    return await this.model.findOne({ whatsappNumber });
  }
}

class ConversationRepository extends BaseRepository {
  constructor() {
    super(Conversation);
  }

  async findByBusiness(businessId, options = {}) {
    return await this.find({ business: businessId }, { ...options, sort: { lastMessageAt: -1 } });
  }

  async findByBusinessAndCustomer(businessId, customerPhone) {
    return await this.findOne({ business: businessId, customerPhone });
  }

  async updateLastMessage(conversationId) {
    return await this.updateById(conversationId, { 
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 }
    });
  }
}

class MessageRepository extends BaseRepository {
  constructor() {
    super(Message);
  }

  async findByConversation(conversationId, options = {}) {
    return await this.find({ conversation: conversationId }, { ...options, sort: { createdAt: 1 } });
  }

  async findRecentByBusiness(businessId, limit = 50) {
    return await this.find(
      { business: businessId },
      { sort: { createdAt: -1 }, limit }
    );
  }
}

class KnowledgeBaseRepository extends BaseRepository {
  constructor() {
    super(KnowledgeBase);
  }

  async findByBusiness(businessId, options = {}) {
    return await this.find({ business: businessId, isActive: true }, options);
  }

  async findByBusinessAndCategory(businessId, category) {
    return await this.find({ business: businessId, category, isActive: true });
  }

  async searchByContent(businessId, query) {
    return await this.model.find({
      business: businessId,
      isActive: true,
      $text: { $search: query }
    }).sort({ score: { $meta: 'textScore' } });
  }
}

class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  async findByBusiness(businessId, options = {}) {
    return await this.find({ business: businessId }, { ...options, sort: { createdAt: -1 } });
  }

  async findByCustomer(businessId, customerPhone) {
    return await this.find({ business: businessId, customerPhone }, { sort: { createdAt: -1 } });
  }

  async findByStatus(businessId, status) {
    return await this.find({ business: businessId, status }, { sort: { createdAt: -1 } });
  }
}

class LeadRepository extends BaseRepository {
  constructor() {
    super(Lead);
  }

  async findByBusiness(businessId, options = {}) {
    return await this.find({ business: businessId }, { ...options, sort: { createdAt: -1 } });
  }

  async findByStatus(businessId, status) {
    return await this.find({ business: businessId, status }, { sort: { createdAt: -1 } });
  }

  async findByCustomer(businessId, customerPhone) {
    return await this.findOne({ business: businessId, customerPhone });
  }
}

module.exports = {
  BaseRepository,
  UserRepository,
  BusinessRepository,
  ConversationRepository,
  MessageRepository,
  KnowledgeBaseRepository,
  OrderRepository,
  LeadRepository
};