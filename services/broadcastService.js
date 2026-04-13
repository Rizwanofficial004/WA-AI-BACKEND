// Broadcast Service
// Handles sending broadcast messages/campaigns to customers

const { Broadcast, Conversation, Lead, Message, Business, ChatTag } = require('../models');
const conversationStateService = require('./conversationStateService');
const whatsappService = require('./whatsappService');

class BroadcastService {
  
  /**
   * Create a new broadcast campaign
   */
  async createBroadcast(businessId, data) {
    try {
      const broadcast = await Broadcast.create({
        business: businessId,
        name: data.name,
        description: data.description,
        message: data.message,
        messageType: data.messageType || 'text',
        templateName: data.templateName,
        templateLanguage: data.templateLanguage,
        templateParams: data.templateParams,
        mediaUrl: data.mediaUrl,
        mediaCaption: data.mediaCaption,
        target: data.target || { type: 'all' },
        scheduledAt: data.scheduledAt,
        createdBy: data.createdBy,
        tags: data.tags || [],
        rateLimitPerMinute: data.rateLimitPerMinute || 50
      });

      return broadcast;
    } catch (error) {
      console.error('[Broadcast] Error creating broadcast:', error);
      throw error;
    }
  }

  /**
   * Get target phones based on broadcast target configuration
   */
  async getTargetPhones(businessId, target) {
    try {
      let phones = [];

      switch (target.type) {
        case 'all':
          // Get all unique customer phones from conversations
          const allConversations = await Conversation.find({
            business: businessId,
            status: { $ne: 'archived' }
          }).distinct('customerPhone');
          phones = allConversations;
          break;

        case 'tag':
          // Get conversations with specific tag(s)
          const tagConversations = await Conversation.find({
            business: businessId,
            'tags.name': { $in: target.tags || [] },
            status: { $ne: 'archived' }
          }).distinct('customerPhone');
          phones = tagConversations;
          break;

        case 'specific':
          // Specific phone numbers
          phones = target.specificPhones || [];
          break;

        case 'leads':
          // Get all leads
          const leads = await Lead.find({
            business: businessId,
            status: { $ne: 'lost' }
          }).distinct('customerPhone');
          phones = leads;
          break;

        case 'no_orders':
          // Get customers who haven't placed orders
          const { Order } = require('../models');
          const customersWithOrders = await Order.find({
            business: businessId
          }).distinct('customerPhone');
          
          const allCustomers = await Conversation.find({
            business: businessId
          }).distinct('customerPhone');
          
          phones = allCustomers.filter(p => !customersWithOrders.includes(p));
          break;

        case 'inactive':
          // Get customers inactive for X days
          const inactiveDate = new Date();
          inactiveDate.setDate(inactiveDate.getDate() - (target.inactiveDays || 30));
          
          const inactiveConversations = await Conversation.find({
            business: businessId,
            lastMessageAt: { $lt: inactiveDate }
          }).distinct('customerPhone');
          phones = inactiveConversations;
          break;

        default:
          phones = [];
      }

      // Remove duplicates
      return [...new Set(phones)];
    } catch (error) {
      console.error('[Broadcast] Error getting target phones:', error);
      return [];
    }
  }

  /**
   * Start sending broadcast
   */
  async startBroadcast(businessId, broadcastId) {
    try {
      const broadcast = await Broadcast.findById(broadcastId);
      
      if (!broadcast) {
        throw new Error('Broadcast not found');
      }

      if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
        throw new Error('Broadcast already sent or in progress');
      }

      // Get target phones
      const phones = await this.getTargetPhones(businessId, broadcast.target);
      
      if (phones.length === 0) {
        throw new Error('No target recipients found');
      }

      // Update broadcast status
      await Broadcast.findByIdAndUpdate(broadcastId, {
        status: 'sending',
        startedAt: new Date(),
        'stats.totalTargeted': phones.length
      });

      // Get business
      const business = await Business.findById(businessId);
      if (!business) {
        throw new Error('Business not found');
      }

      // Start sending in background
      this._sendBroadcast(broadcast, business, phones);

      return {
        success: true,
        totalTargeted: phones.length
      };
    } catch (error) {
      console.error('[Broadcast] Error starting broadcast:', error);
      throw error;
    }
  }

  /**
   * Send broadcast to phones (background process)
   */
  async _sendBroadcast(broadcast, business, phones) {
    const rateLimit = broadcast.rateLimitPerMinute || 50;
    const delayMs = Math.ceil(60000 / rateLimit); // ms between messages

    let sent = 0;
    let failed = 0;
    const failedReasons = [];

    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i];

      try {
        // Check rate limit
        const canSend = await conversationStateService.checkBroadcastRate(
          business._id.toString(),
          rateLimit
        );

        if (!canSend) {
          console.log('[Broadcast] Rate limit reached, waiting...');
          await this._sleep(5000);
          continue;
        }

        // Check if broadcast was cancelled
        const currentBroadcast = await Broadcast.findById(broadcast._id);
        if (currentBroadcast.status === 'cancelled') {
          console.log('[Broadcast] Broadcast cancelled');
          break;
        }

        // Send message
        if (broadcast.messageType === 'text') {
          const graphResult = await whatsappService.sendMessage(business, phone, broadcast.message);
          if (!graphResult) {
            throw new Error('WhatsApp API did not accept the message');
          }
        } else if (broadcast.messageType === 'template') {
          await whatsappService.sendTemplateMessage(
            business,
            phone,
            broadcast.templateName,
            broadcast.templateLanguage
          );
        } else if (broadcast.messageType === 'image' && broadcast.mediaUrl) {
          await whatsappService.sendImageMessage(
            business,
            phone,
            broadcast.mediaUrl,
            broadcast.mediaCaption || broadcast.message
          );
        }

        sent++;

        // Create message record
        await Message.create({
          business: business._id,
          sender: 'ai',
          content: broadcast.message,
          messageType: broadcast.messageType,
          metadata: {
            broadcastId: broadcast._id,
            timestamp: new Date()
          }
        });

        console.log(`[Broadcast] Sent to ${phone} (${sent}/${phones.length})`);

      } catch (error) {
        failed++;
        failedReasons.push({
          phone,
          reason: error.message || 'Unknown error'
        });
        console.error(`[Broadcast] Failed to send to ${phone}:`, error.message);
      }

      // Delay between messages
      if (i < phones.length - 1) {
        await this._sleep(delayMs);
      }
    }

    // Update broadcast with final stats
    await Broadcast.findByIdAndUpdate(broadcast._id, {
      status: 'sent',
      completedAt: new Date(),
      $inc: {
        'stats.sent': sent,
        'stats.failed': failed
      },
      $push: {
        'stats.failedReasons': { $each: failedReasons }
      }
    });

    console.log(`[Broadcast] Completed: ${sent} sent, ${failed} failed`);
  }

  /**
   * Schedule broadcast for later
   */
  async scheduleBroadcast(businessId, broadcastId, scheduledAt) {
    try {
      const broadcast = await Broadcast.findByIdAndUpdate(
        broadcastId,
        { scheduledAt, status: 'scheduled' },
        { new: true }
      );

      return broadcast;
    } catch (error) {
      console.error('[Broadcast] Error scheduling broadcast:', error);
      throw error;
    }
  }

  /**
   * Cancel broadcast
   */
  async cancelBroadcast(businessId, broadcastId) {
    try {
      const broadcast = await Broadcast.findByIdAndUpdate(
        broadcastId,
        { status: 'cancelled' },
        { new: true }
      );

      return broadcast;
    } catch (error) {
      console.error('[Broadcast] Error cancelling broadcast:', error);
      throw error;
    }
  }

  /**
   * Get broadcast stats
   */
  async getBroadcastStats(businessId, broadcastId) {
    try {
      const broadcast = await Broadcast.findById(broadcastId);
      
      if (!broadcast) {
        throw new Error('Broadcast not found');
      }

      const stats = {
        totalTargeted: broadcast.stats.totalTargeted,
        sent: broadcast.stats.sent,
        delivered: broadcast.stats.delivered,
        read: broadcast.stats.read,
        failed: broadcast.stats.failed,
        failedReasons: broadcast.stats.failedReasons,
        status: broadcast.status,
        progress: broadcast.stats.totalTargeted > 0
          ? Math.round(((broadcast.stats.sent + broadcast.stats.failed) / broadcast.stats.totalTargeted) * 100)
          : 0
      };

      return stats;
    } catch (error) {
      console.error('[Broadcast] Error getting broadcast stats:', error);
      throw error;
    }
  }

  /**
   * Get all broadcasts for business
   */
  async getBroadcasts(businessId, options = {}) {
    try {
      const { page = 1, limit = 20, status } = options;
      
      const query = { business: businessId };
      if (status) {
        query.status = status;
      }

      const broadcasts = await Broadcast.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean();

      const total = await Broadcast.countDocuments(query);

      return {
        broadcasts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('[Broadcast] Error getting broadcasts:', error);
      throw error;
    }
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new BroadcastService();
