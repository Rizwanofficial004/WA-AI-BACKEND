const { ConversationRepository, MessageRepository, LeadRepository } = require('../repositories');

class ConversationService {
  constructor() {
    this.conversationRepository = new ConversationRepository();
    this.messageRepository = new MessageRepository();
    this.leadRepository = new LeadRepository();
  }

  async getConversationsByBusiness(businessId, options = {}) {
    return await this.conversationRepository.findByBusiness(businessId, options);
  }

  async getConversationById(conversationId, businessId) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.business.toString() !== businessId.toString()) {
      throw new Error('Conversation not found');
    }
    return conversation;
  }

  async getConversationWithMessages(conversationId, businessId) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.business.toString() !== businessId.toString()) {
      throw new Error('Conversation not found');
    }

    const messages = await this.messageRepository.findByConversation(conversationId);

    return {
      conversation,
      messages
    };
  }

  async getOrCreateConversation(businessId, customerPhone, customerName = null) {
    let conversation = await this.conversationRepository.findByBusinessAndCustomer(
      businessId,
      customerPhone
    );

    if (!conversation) {
      conversation = await this.conversationRepository.create({
        business: businessId,
        customerPhone,
        customerName
      });
    }

    return conversation;
  }

  async addMessage(conversationId, businessId, messageData) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.business.toString() !== businessId.toString()) {
      throw new Error('Conversation not found');
    }

    // Create message
    const message = await this.messageRepository.create({
      conversation: conversationId,
      business: businessId,
      ...messageData
    });

    // Update conversation
    await this.conversationRepository.updateLastMessage(conversationId);

    return message;
  }

  async updateConversationStatus(conversationId, businessId, status) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.business.toString() !== businessId.toString()) {
      throw new Error('Conversation not found');
    }

    const updatedConversation = await this.conversationRepository.updateById(conversationId, { status });
    return updatedConversation;
  }

  async getConversationStats(businessId) {
    const conversations = await this.conversationRepository.findByBusiness(businessId);
    
    const stats = {
      total: conversations.length,
      active: 0,
      resolved: 0,
      pending: 0
    };

    conversations.forEach(conv => {
      stats[conv.status]++;
    });

    return stats;
  }

  async createLeadFromConversation(conversationId, businessId, leadData) {
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.business.toString() !== businessId.toString()) {
      throw new Error('Conversation not found');
    }

    // Check if lead already exists
    const existingLead = await this.leadRepository.findByCustomer(
      businessId,
      conversation.customerPhone
    );

    if (existingLead) {
      throw new Error('Lead already exists for this customer');
    }

    const lead = await this.leadRepository.create({
      business: businessId,
      conversation: conversationId,
      customerPhone: conversation.customerPhone,
      customerName: conversation.customerName,
      ...leadData
    });

    return lead;
  }
}

module.exports = new ConversationService();