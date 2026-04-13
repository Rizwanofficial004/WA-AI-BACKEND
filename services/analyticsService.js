// Analytics Service
// Tracks and aggregates business metrics for dashboard

const { Analytics, Conversation, Message, Lead, Order, Agent, Broadcast } = require('../models');

class AnalyticsService {
  
  /**
   * Record daily analytics
   */
  async recordDailyAnalytics(businessId, date = new Date()) {
    try {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Aggregate data
      const [
        conversationStats,
        messageStats,
        leadStats,
        orderStats,
        agentStats
      ] = await Promise.all([
        this._aggregateConversationStats(businessId, dayStart, dayEnd),
        this._aggregateMessageStats(businessId, dayStart, dayEnd),
        this._aggregateLeadStats(businessId, dayStart, dayEnd),
        this._aggregateOrderStats(businessId, dayStart, dayEnd),
        this._aggregateAgentStats(businessId, dayStart, dayEnd)
      ]);

      // Calculate hourly breakdown
      const hourlyBreakdown = await this._getHourlyBreakdown(businessId, dayStart, dayEnd);

      // Upsert analytics record
      const analytics = await Analytics.findOneAndUpdate(
        { business: businessId, date: dayStart },
        {
          $set: {
            conversations: conversationStats,
            messages: messageStats,
            leads: leadStats,
            orders: orderStats,
            agentStats: agentStats,
            hourlyBreakdown: hourlyBreakdown
          }
        },
        { upsert: true, new: true }
      );

      return analytics;
    } catch (error) {
      console.error('[Analytics] Error recording daily analytics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard analytics for date range
   */
  async getDashboardAnalytics(businessId, { startDate, endDate, period = '7d' }) {
    try {
      // Calculate date range
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : this._getStartDate(period);
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Get analytics records
      const analytics = await Analytics.find({
        business: businessId,
        date: { $gte: start, $lte: end }
      }).sort({ date: 1 });

      // Aggregate totals
      const totals = this._aggregateTotals(analytics);

      // Get current counts (for live data)
      const [
        activeConversations,
        unresolvedChats,
        onlineAgents,
        pendingHandoffs,
        unreadMessages
      ] = await Promise.all([
        Conversation.countDocuments({ business: businessId, status: 'active' }),
        Conversation.countDocuments({ business: businessId, isBotActive: false, status: { $ne: 'resolved' } }),
        Agent.countDocuments({ business: businessId, status: 'online' }),
        Conversation.countDocuments({ business: businessId, handoffRequested: true }),
        Message.countDocuments({ business: businessId, sender: 'customer', 'metadata.status': { $ne: 'read' } })
      ]);

      // Calculate trends
      const trends = this._calculateTrends(analytics);

      // Get top tags
      const topTags = await this._getTopTags(businessId, start, end);

      // Get agent performance
      const agentPerformance = await this._getAgentPerformance(businessId, start, end);

      return {
        period: { start, end },
        totals,
        live: {
          activeConversations,
          unresolvedChats,
          onlineAgents,
          pendingHandoffs,
          unreadMessages
        },
        trends,
        topTags,
        agentPerformance,
        dailyBreakdown: analytics.map(a => ({
          date: a.date,
          ...a.toObject()
        }))
      };
    } catch (error) {
      console.error('[Analytics] Error getting dashboard analytics:', error);
      throw error;
    }
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(businessId, { startDate, endDate }) {
    try {
      const start = startDate ? new Date(startDate) : this._getStartDate('30d');
      const end = endDate ? new Date(endDate) : new Date();

      // Total conversations
      const totalConversations = await Conversation.countDocuments({
        business: businessId,
        createdAt: { $gte: start, $lte: end }
      });

      // By status
      const byStatus = await Conversation.aggregate([
        { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Bot vs Agent
      const botVsAgent = await Conversation.aggregate([
        { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            botHandled: { $sum: { $cond: ['$isBotActive', 1, 0] } },
            agentHandled: { $sum: { $cond: [{ $eq: ['$isBotActive', false] }, 1, 0] } },
            handoffs: { $sum: { $cond: ['$handoffRequested', 1, 0] } }
          }
        }
      ]);

      // Average response time
      const avgResponseTime = await Message.aggregate([
        {
          $match: {
            business: require('mongoose').Types.ObjectId(businessId),
            createdAt: { $gte: start, $lte: end },
            sender: { $in: ['ai', 'agent'] }
          }
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$responseTime' }
          }
        }
      ]);

      return {
        total: totalConversations,
        byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        botVsAgent: botVsAgent[0] || { botHandled: 0, agentHandled: 0, handoffs: 0 },
        avgResponseTime: avgResponseTime[0]?.avgTime || 0
      };
    } catch (error) {
      console.error('[Analytics] Error getting conversation analytics:', error);
      throw error;
    }
  }

  /**
   * Get lead analytics
   */
  async getLeadAnalytics(businessId, { startDate, endDate }) {
    try {
      const start = startDate ? new Date(startDate) : this._getStartDate('30d');
      const end = endDate ? new Date(endDate) : new Date();

      const totalLeads = await Lead.countDocuments({
        business: businessId,
        createdAt: { $gte: start, $lte: end }
      });

      const byStatus = await Lead.aggregate([
        { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const bySource = await Lead.aggregate([
        { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]);

      const conversionRate = await this._calculateConversionRate(businessId, start, end);

      return {
        total: totalLeads,
        byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        bySource: bySource.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        conversionRate
      };
    } catch (error) {
      console.error('[Analytics] Error getting lead analytics:', error);
      throw error;
    }
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(businessId, { startDate, endDate }) {
    try {
      const start = startDate ? new Date(startDate) : this._getStartDate('30d');
      const end = endDate ? new Date(endDate) : new Date();

      const totalOrders = await Order.countDocuments({
        business: businessId,
        createdAt: { $gte: start, $lte: end }
      });

      const revenue = await Order.aggregate([
        {
          $match: {
            business: require('mongoose').Types.ObjectId(businessId),
            createdAt: { $gte: start, $lte: end },
            status: { $nin: ['cancelled'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            avg: { $avg: '$totalAmount' }
          }
        }
      ]);

      const byStatus = await Order.aggregate([
        { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }
      ]);

      return {
        total: totalOrders,
        revenue: revenue[0]?.total || 0,
        avgOrderValue: revenue[0]?.avg || 0,
        byStatus: byStatus.reduce((acc, item) => ({
          ...acc,
          [item._id]: { count: item.count, revenue: item.revenue }
        }), {})
      };
    } catch (error) {
      console.error('[Analytics] Error getting order analytics:', error);
      throw error;
    }
  }

  /**
   * Get AI usage analytics
   */
  async getAIAnalytics(businessId, { startDate, endDate }) {
    try {
      const start = startDate ? new Date(startDate) : this._getStartDate('30d');
      const end = endDate ? new Date(endDate) : new Date();

      const aiMessages = await Message.countDocuments({
        business: businessId,
        sender: 'ai',
        isAIgenerated: true,
        createdAt: { $gte: start, $lte: end }
      });

      const totalMessages = await Message.countDocuments({
        business: businessId,
        createdAt: { $gte: start, $lte: end }
      });

      const aiPercentage = totalMessages > 0 ? Math.round((aiMessages / totalMessages) * 100) : 0;

      // Get daily AI usage
      const dailyUsage = await Message.aggregate([
        {
          $match: {
            business: require('mongoose').Types.ObjectId(businessId),
            sender: 'ai',
            isAIgenerated: true,
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return {
        totalAIMessages: aiMessages,
        totalMessages,
        aiPercentage,
        dailyUsage
      };
    } catch (error) {
      console.error('[Analytics] Error getting AI analytics:', error);
      throw error;
    }
  }

  // =====================
  // HELPER METHODS
  // =====================

  _getStartDate(period) {
    const date = new Date();
    switch (period) {
      case '24h':
        date.setHours(date.getHours() - 24);
        break;
      case '7d':
        date.setDate(date.getDate() - 7);
        break;
      case '30d':
        date.setDate(date.getDate() - 30);
        break;
      case '90d':
        date.setDate(date.getDate() - 90);
        break;
      default:
        date.setDate(date.getDate() - 7);
    }
    return date;
  }

  async _aggregateConversationStats(businessId, start, end) {
    const stats = await Conversation.aggregate([
      { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          botHandled: { $sum: { $cond: ['$isBotActive', 1, 0] } },
          agentHandled: { $sum: { $cond: [{ $eq: ['$isBotActive', false] }, 1, 0] } },
          handoffs: { $sum: { $cond: ['$handoffRequested', 1, 0] } }
        }
      }
    ]);

    return stats[0] || { total: 0, resolved: 0, botHandled: 0, agentHandled: 0, handoffs: 0 };
  }

  async _aggregateMessageStats(businessId, start, end) {
    const stats = await Message.aggregate([
      { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          incoming: { $sum: { $cond: [{ $eq: ['$sender', 'customer'] }, 1, 0] } },
          outgoing: { $sum: { $cond: [{ $ne: ['$sender', 'customer'] }, 1, 0] } },
          fromBot: { $sum: { $cond: [{ $and: [{ $eq: ['$sender', 'ai'] }, { $eq: ['$isAIgenerated', true] }] }, 1, 0] } },
          fromAgent: { $sum: { $cond: [{ $eq: ['$sender', 'agent'] }, 1, 0] } }
        }
      }
    ]);

    return stats[0] || { total: 0, incoming: 0, outgoing: 0, fromBot: 0, fromAgent: 0 };
  }

  async _aggregateLeadStats(businessId, start, end) {
    const stats = await Lead.aggregate([
      { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
          qualified: { $sum: { $cond: [{ $eq: ['$status', 'qualified'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } }
        }
      }
    ]);

    return stats[0] || { total: 0, new: 0, qualified: 0, converted: 0 };
  }

  async _aggregateOrderStats(businessId, start, end) {
    const stats = await Order.aggregate([
      { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $nin: ['$status', ['cancelled']] }, '$totalAmount', 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
        }
      }
    ]);

    return stats[0] || { total: 0, revenue: 0, confirmed: 0, delivered: 0 };
  }

  async _aggregateAgentStats(businessId, start, end) {
    const agents = await Agent.find({ business: businessId });
    
    const stats = [];
    for (const agent of agents) {
      const messages = await Message.countDocuments({
        business: businessId,
        sender: 'agent',
        createdAt: { $gte: start, $lt: end }
      });

      stats.push({
        agent: agent._id,
        name: agent.name,
        messagesSent: messages
      });
    }

    return stats;
  }

  async _getHourlyBreakdown(businessId, start, end) {
    const breakdown = await Message.aggregate([
      { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          messages: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing hours
    const hourly = [];
    for (let i = 0; i < 24; i++) {
      const found = breakdown.find(b => b._id === i);
      hourly.push({
        hour: i,
        messages: found?.messages || 0
      });
    }

    return hourly;
  }

  _aggregateTotals(analytics) {
    return analytics.reduce((acc, day) => ({
      conversations: acc.conversations + (day.conversations?.total || 0),
      messages: acc.messages + (day.messages?.total || 0),
      leads: acc.leads + (day.leads?.total || 0),
      orders: acc.orders + (day.orders?.total || 0),
      revenue: acc.revenue + (day.orders?.revenue || 0),
      botHandled: acc.botHandled + (day.conversations?.botHandled || 0),
      agentHandled: acc.agentHandled + (day.conversations?.agentHandled || 0)
    }), { conversations: 0, messages: 0, leads: 0, orders: 0, revenue: 0, botHandled: 0, agentHandled: 0 });
  }

  _calculateTrends(analytics) {
    if (analytics.length < 2) {
      return {
        conversations: 0,
        messages: 0,
        leads: 0,
        orders: 0,
        revenue: 0
      };
    }

    const half = Math.floor(analytics.length / 2);
    const firstHalf = analytics.slice(0, half);
    const secondHalf = analytics.slice(half);

    const sumFirst = this._aggregateTotals(firstHalf);
    const sumSecond = this._aggregateTotals(secondHalf);

    return {
      conversations: this._calculatePercentChange(sumFirst.conversations, sumSecond.conversations),
      messages: this._calculatePercentChange(sumFirst.messages, sumSecond.messages),
      leads: this._calculatePercentChange(sumFirst.leads, sumSecond.leads),
      orders: this._calculatePercentChange(sumFirst.orders, sumSecond.orders),
      revenue: this._calculatePercentChange(sumFirst.revenue, sumSecond.revenue)
    };
  }

  _calculatePercentChange(oldVal, newVal) {
    if (oldVal === 0) return newVal > 0 ? 100 : 0;
    return Math.round(((newVal - oldVal) / oldVal) * 100);
  }

  async _getTopTags(businessId, start, end) {
    const conversations = await Conversation.aggregate([
      { $match: { business: require('mongoose').Types.ObjectId(businessId), createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return conversations.map(c => ({ name: c._id, count: c.count }));
  }

  async _getAgentPerformance(businessId, start, end) {
    const performance = await Agent.find({ business: businessId })
      .select('name stats')
      .lean();

    return performance;
  }

  async _calculateConversionRate(businessId, start, end) {
    const leads = await Lead.countDocuments({
      business: businessId,
      createdAt: { $gte: start, $lte: end }
    });

    const converted = await Lead.countDocuments({
      business: businessId,
      createdAt: { $gte: start, $lte: end },
      status: 'converted'
    });

    return leads > 0 ? Math.round((converted / leads) * 100) : 0;
  }
}

module.exports = new AnalyticsService();
