const { BusinessRepository } = require('../repositories');

class BusinessService {
  constructor() {
    this.businessRepository = new BusinessRepository();
  }

  async createBusiness(businessData, ownerId) {
    const business = await this.businessRepository.create({
      ...businessData,
      owner: ownerId
    });
    return business;
  }

  async getBusinessById(businessId) {
    const business = await this.businessRepository.findById(businessId, 'owner');
    if (!business) {
      throw new Error('Business not found');
    }
    return business;
  }

  async getBusinessesByOwner(ownerId) {
    return await this.businessRepository.findByOwner(ownerId);
  }

  async updateBusiness(businessId, updateData, ownerId) {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    if (business.owner.toString() !== ownerId.toString()) {
      throw new Error('Not authorized to update this business');
    }

    const updatedBusiness = await this.businessRepository.updateById(businessId, updateData);
    return updatedBusiness;
  }

  async deleteBusiness(businessId, ownerId) {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    if (business.owner.toString() !== ownerId.toString()) {
      throw new Error('Not authorized to delete this business');
    }

    await this.businessRepository.deleteById(businessId);
    return { message: 'Business deleted successfully' };
  }

  async connectWhatsApp(businessId, whatsappData, ownerId) {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    if (business.owner.toString() !== ownerId.toString()) {
      throw new Error('Not authorized to update this business');
    }

    console.log('connectWhatsApp - received data:', whatsappData);

    // Use data from request body (business owner provides these)
    const updateData = {
      isWhatsAppConnected: true,
      whatsappNumber: whatsappData.whatsappNumber || business.whatsappNumber,
      whatsappPhoneNumberId: whatsappData.phoneNumberId || business.whatsappPhoneNumberId,
      whatsappCredentials: {
        token: whatsappData.token || '',
        verifyToken: whatsappData.verifyToken || '',
        phoneNumberId: whatsappData.phoneNumberId || '',
        businessAccountId: whatsappData.businessAccountId || '',
        webhookUrl: whatsappData.webhookUrl || ''
      }
    };

    console.log('connectWhatsApp - updateData:', updateData);

    const updatedBusiness = await this.businessRepository.updateById(businessId, updateData);

    console.log('connectWhatsApp - updated business:', updatedBusiness);
    return updatedBusiness;
  }

  async toggleAI(businessId, isEnabled, ownerId) {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    if (business.owner.toString() !== ownerId.toString()) {
      throw new Error('Not authorized to update this business');
    }

    const updatedBusiness = await this.businessRepository.updateById(businessId, {
      isAIEnabled: isEnabled
    });

    return updatedBusiness;
  }

  async updateBusinessSettings(businessId, settings, ownerId) {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    if (business.owner.toString() !== ownerId.toString()) {
      throw new Error('Not authorized to update this business');
    }

    const updateData = {};
    
    if (settings.name) updateData.name = settings.name;
    if (settings.description !== undefined) updateData.description = settings.description;
    if (settings.category !== undefined) updateData.category = settings.category;
    if (settings.businessType) updateData.businessType = settings.businessType;
    if (settings.aiApiKey !== undefined) updateData.aiApiKey = settings.aiApiKey;
    if (settings.aiPersonality !== undefined) updateData.aiPersonality = settings.aiPersonality;
    if (settings.welcomeMessage !== undefined) updateData.welcomeMessage = settings.welcomeMessage;
    if (settings.quickActions !== undefined) updateData.quickActions = settings.quickActions;
    if (settings.settings) updateData.settings = settings.settings;

    const updatedBusiness = await this.businessRepository.updateById(businessId, updateData);

    return updatedBusiness;
  }

  async getBusinessStats(businessId, ownerId) {
    const business = await this.businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    if (business.owner.toString() !== ownerId.toString()) {
      throw new Error('Not authorized to view this business');
    }

    // Get stats from related collections
    const { Conversation, Message, Order, Lead } = require('../models');

    const [
      totalConversations,
      activeConversations,
      totalMessages,
      totalOrders,
      totalLeads
    ] = await Promise.all([
      Conversation.countDocuments({ business: businessId }),
      Conversation.countDocuments({ business: businessId, status: 'active' }),
      Message.countDocuments({ business: businessId }),
      Order.countDocuments({ business: businessId }),
      Lead.countDocuments({ business: businessId })
    ]);

    return {
      totalConversations,
      activeConversations,
      totalMessages,
      totalOrders,
      totalLeads
    };
  }
}

module.exports = new BusinessService();