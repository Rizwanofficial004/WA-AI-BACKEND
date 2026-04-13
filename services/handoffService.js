// Human Agent Handoff Service
// Handles transferring conversations from bot to human agents

const { Conversation, Agent, Message } = require('../models');
const conversationStateService = require('./conversationStateService');

class HandoffService {
  
  /**
   * Request handoff to human agent
   */
  async requestHandoff({ businessId, conversationId, customerPhone, reason = 'customer_request', customerMessage = null }) {
    try {
      // Update conversation
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        {
          isBotActive: false,
          handoffRequested: true,
          handoffReason: reason,
          handoffRequestedAt: new Date(),
          status: 'pending'
        },
        { new: true }
      );

      // Update conversation state
      await conversationStateService.setConversationState(
        businessId,
        customerPhone,
        conversationStateService.STATES.HANDOFF_TO_AGENT,
        { reason, requestedAt: new Date() }
      );

      // Add to handoff queue
      await conversationStateService.addToHandoffQueue(businessId, conversationId, reason);

      // Try to auto-assign to available agent
      const assigned = await this.autoAssignAgent(businessId, conversationId);

      console.log(`[Handoff] Requested for conversation ${conversationId}, auto-assigned: ${!!assigned}`);

      return {
        success: true,
        conversation,
        assignedAgent: assigned
      };
    } catch (error) {
      console.error('[Handoff] Error requesting handoff:', error);
      throw error;
    }
  }

  /**
   * Auto-assign conversation to available agent
   */
  async autoAssignAgent(businessId, conversationId) {
    try {
      // Find available agents
      const availableAgents = await Agent.find({
        business: businessId,
        isActive: true,
        status: 'online',
        $expr: { $lt: ['$currentChatCount', '$maxConcurrentChats'] }
      }).sort({ currentChatCount: 1 });

      if (availableAgents.length === 0) {
        console.log('[Handoff] No available agents');
        return null;
      }

      // Use round-robin with least loaded as tiebreaker
      const agentIds = availableAgents.map(a => a._id.toString());
      const nextAgentId = await conversationStateService.getNextAgent(businessId, agentIds);
      
      const agent = availableAgents.find(a => a._id.toString() === nextAgentId) || availableAgents[0];

      // Assign the agent
      await this.assignAgent(businessId, conversationId, agent._id);

      return agent;
    } catch (error) {
      console.error('[Handoff] Error auto-assigning agent:', error);
      return null;
    }
  }

  /**
   * Assign specific agent to conversation
   */
  async assignAgent(businessId, conversationId, agentId) {
    try {
      // Verify agent exists and is available
      const agent = await Agent.findOne({
        _id: agentId,
        business: businessId,
        isActive: true
      });

      if (!agent) {
        throw new Error('Agent not found or inactive');
      }

      // Update conversation
      const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        {
          assignedAgent: agentId,
          assignedAt: new Date(),
          handoffRequested: false
        },
        { new: true }
      ).populate('assignedAgent');

      // Update agent chat count
      await Agent.findByIdAndUpdate(agentId, {
        $inc: { currentChatCount: 1, 'stats.totalChatsHandled': 1 }
      });

      // Get customer phone for Redis
      await conversationStateService.assignAgent(businessId, conversation.customerPhone, agentId);

      // Remove from handoff queue
      await conversationStateService.removeFromHandoffQueue(businessId, conversationId);

      console.log(`[Handoff] Assigned agent ${agent.name} to conversation ${conversationId}`);

      return conversation;
    } catch (error) {
      console.error('[Handoff] Error assigning agent:', error);
      throw error;
    }
  }

  /**
   * Release agent from conversation (close/resolved)
   */
  async releaseAgent(businessId, conversationId, agentId) {
    try {
      // Update agent chat count
      await Agent.findByIdAndUpdate(agentId, {
        $inc: { currentChatCount: -1 }
      });

      // Update conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        status: 'resolved'
      });

      console.log(`[Handoff] Released agent ${agentId} from conversation ${conversationId}`);
    } catch (error) {
      console.error('[Handoff] Error releasing agent:', error);
    }
  }

  /**
   * Transfer conversation to another agent
   */
  async transferAgent(businessId, conversationId, fromAgentId, toAgentId, reason = null) {
    try {
      // Release from current agent
      await this.releaseAgent(businessId, conversationId, fromAgentId);

      // Assign to new agent
      const conversation = await this.assignAgent(businessId, conversationId, toAgentId);

      // Add transfer note
      if (reason) {
        await Conversation.findByIdAndUpdate(conversationId, {
          $push: {
            notes: {
              content: `Transferred from agent to ${toAgentId}. Reason: ${reason}`,
              addedAt: new Date()
            }
          }
        });
      }

      console.log(`[Handoff] Transferred conversation ${conversationId} from ${fromAgentId} to ${toAgentId}`);

      return conversation;
    } catch (error) {
      console.error('[Handoff] Error transferring agent:', error);
      throw error;
    }
  }

  /**
   * Get handoff queue for business
   */
  async getHandoffQueue(businessId) {
    try {
      const queue = await conversationStateService.getHandoffQueue(businessId);
      
      // Enrich with conversation data
      const enrichedQueue = [];
      for (const item of queue) {
        const conversation = await Conversation.findById(item.conversationId)
          .populate('assignedAgent')
          .lean();
        
        if (conversation) {
          // Get last message
          const lastMessage = await Message.findOne({ conversation: item.conversationId })
            .sort({ createdAt: -1 })
            .lean();

          enrichedQueue.push({
            ...item,
            conversation: {
              ...conversation,
              lastMessage: lastMessage?.content || ''
            }
          });
        }
      }

      return enrichedQueue;
    } catch (error) {
      console.error('[Handoff] Error getting handoff queue:', error);
      return [];
    }
  }

  /**
   * Get unassigned conversations (waiting for agent)
   */
  async getUnassignedConversations(businessId) {
    try {
      const conversations = await Conversation.find({
        business: businessId,
        handoffRequested: true,
        assignedAgent: null,
        status: { $ne: 'resolved' }
      })
      .sort({ handoffRequestedAt: 1 })
      .populate('assignedAgent')
      .lean();

      return conversations;
    } catch (error) {
      console.error('[Handoff] Error getting unassigned conversations:', error);
      return [];
    }
  }

  /**
   * Get agent's assigned conversations
   */
  async getAgentConversations(businessId, agentId) {
    try {
      const conversations = await Conversation.find({
        business: businessId,
        assignedAgent: agentId,
        status: { $ne: 'resolved' }
      })
      .sort({ lastMessageAt: -1 })
      .lean();

      return conversations;
    } catch (error) {
      console.error('[Handoff] Error getting agent conversations:', error);
      return [];
    }
  }

  /**
   * Return conversation to bot (after agent resolution)
   */
  async returnToBot(businessId, conversationId) {
    try {
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Release agent if assigned
      if (conversation.assignedAgent) {
        await this.releaseAgent(businessId, conversationId, conversation.assignedAgent);
      }

      // Update conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        isBotActive: true,
        handoffRequested: false,
        handoffReason: null,
        assignedAgent: null
      });

      // Reset conversation state
      await conversationStateService.clearConversationState(businessId, conversation.customerPhone);

      console.log(`[Handoff] Returned conversation ${conversationId} to bot`);

      return { success: true };
    } catch (error) {
      console.error('[Handoff] Error returning to bot:', error);
      throw error;
    }
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(businessId, agentId, status) {
    try {
      await Agent.findByIdAndUpdate(agentId, {
        status,
        lastActive: new Date()
      });

      // Update Redis
      if (status === 'online') {
        await conversationStateService.setAgentOnline(businessId, agentId);
      } else if (status === 'offline') {
        await conversationStateService.setAgentOffline(businessId, agentId);
      }

      console.log(`[Handoff] Updated agent ${agentId} status to ${status}`);
    } catch (error) {
      console.error('[Handoff] Error updating agent status:', error);
    }
  }
}

module.exports = new HandoffService();
