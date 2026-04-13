// Automation Rules Engine
// Evaluates incoming messages against automation rules and executes actions

const { AutomationRule, Agent, Conversation } = require('../models');
const conversationStateService = require('./conversationStateService');
const whatsappService = require('./whatsappService');

class AutomationRulesEngine {
  
  constructor() {
    // Cooldown tracking in memory (for simple cases)
    this.cooldowns = new Map();
  }

  /**
   * Process incoming message through automation rules
   * @param {Object} params
   * @returns {Object} - { triggered: boolean, ruleId: string|null, actions: Array }
   */
  async processMessage({ businessId, conversationId, customerPhone, message, messageType }) {
    try {
      console.log(`[AutomationEngine] Processing message from ${customerPhone}`);
      
      // Get all active rules for this business, ordered by priority
      const rules = await AutomationRule.find({
        business: businessId,
        isActive: true
      }).sort({ order: 1 });

      if (rules.length === 0) {
        return { triggered: false };
      }

      // Get conversation state
      const conversationState = await conversationStateService.getConversationState(businessId, customerPhone);

      // Evaluate each rule
      for (const rule of rules) {
        const matched = await this.evaluateTrigger(rule, {
          message,
          messageType,
          conversationState,
          customerPhone
        });

        if (matched) {
          console.log(`[AutomationEngine] Rule matched: ${rule.name}`);
          
          // Check cooldown
          if (this.isInCooldown(rule._id, rule.cooldownMinutes)) {
            console.log(`[AutomationEngine] Rule ${rule.name} is in cooldown`);
            continue;
          }

          // Check execution limit
          if (rule.maxExecutions > 0 && rule.executionCount >= rule.maxExecutions) {
            console.log(`[AutomationEngine] Rule ${rule.name} reached max executions`);
            continue;
          }

          // Execute actions
          const results = await this.executeActions(rule, {
            businessId,
            conversationId,
            customerPhone,
            message
          });

          // Update rule stats
          await AutomationRule.findByIdAndUpdate(rule._id, {
            $inc: { 'stats.totalTriggers': 1, executionCount: 1 },
            $set: { lastExecutedAt: new Date() }
          });

          // Set cooldown
          if (rule.cooldownMinutes > 0) {
            this.setCooldown(rule._id, rule.cooldownMinutes);
          }

          return {
            triggered: true,
            ruleId: rule._id,
            ruleName: rule.name,
            actions: results
          };
        }
      }

      return { triggered: false };
    } catch (error) {
      console.error('[AutomationEngine] Error processing message:', error);
      return { triggered: false, error: error.message };
    }
  }

  /**
   * Evaluate if a rule's trigger matches
   */
  async evaluateTrigger(rule, context) {
    const { trigger } = rule;
    const { message, conversationState } = context;
    const messageLower = message.toLowerCase().trim();

    switch (trigger.type) {
      case 'keyword':
        if (!trigger.keywords || trigger.keywords.length === 0) return false;
        return trigger.keywords.some(keyword => 
          messageLower.includes(keyword.toLowerCase())
        );

      case 'message_contains':
        if (!trigger.keywords || trigger.keywords.length === 0) return false;
        return trigger.keywords.some(keyword => 
          messageLower.includes(keyword.toLowerCase())
        );

      case 'message_exact':
        if (!trigger.keywords || trigger.keywords.length === 0) return false;
        return trigger.keywords.some(keyword => 
          messageLower === keyword.toLowerCase()
        );

      case 'regex':
        if (!trigger.regexPattern) return false;
        try {
          const regex = new RegExp(trigger.regexPattern, 'i');
          return regex.test(message);
        } catch (e) {
          console.error(`[AutomationEngine] Invalid regex: ${trigger.regexPattern}`);
          return false;
        }

      case 'first_message':
        // Check if this is the first message in conversation
        return conversationState.state === 'idle' && !conversationState.data.firstMessageProcessed;

      case 'time_based':
        if (!trigger.timeCondition) return false;
        return this.evaluateTimeCondition(trigger.timeCondition);

      case 'no_response':
        // This is handled differently (via cron or scheduled job)
        return false;

      default:
        return false;
    }
  }

  /**
   * Evaluate time-based condition
   */
  evaluateTimeCondition(condition) {
    const now = new Date();
    
    // Check day of week
    if (condition.daysOfWeek && condition.daysOfWeek.length > 0) {
      const dayOfWeek = now.getDay(); // 0 = Sunday
      if (!condition.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
    }

    // Check time range
    if (condition.startTime && condition.endTime) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = condition.startTime.split(':').map(Number);
      const [endHour, endMin] = condition.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute rule actions
   */
  async executeActions(rule, context) {
    const results = [];
    const { businessId, conversationId, customerPhone, message } = context;

    for (const action of rule.actions) {
      try {
        const result = await this.executeAction(action, context);
        results.push({ type: action.type, success: true, result });
      } catch (error) {
        console.error(`[AutomationEngine] Error executing action ${action.type}:`, error);
        results.push({ type: action.type, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  async executeAction(action, context) {
    const { businessId, conversationId, customerPhone } = context;

    switch (action.type) {
      case 'send_message':
        if (action.message) {
          // Get business to send message
          const { Business } = require('../models');
          const business = await Business.findById(businessId);
          if (business) {
            const wa = await whatsappService.sendMessage(business, customerPhone, action.message);
            if (!wa) {
              return { sent: false, reason: 'whatsapp_api_rejected' };
            }
          }
        }
        return { sent: true };

      case 'send_template':
        if (action.templateName) {
          const { Business } = require('../models');
          const business = await Business.findById(businessId);
          if (business) {
            await whatsappService.sendTemplateMessage(
              business,
              customerPhone,
              action.templateName,
              action.templateLanguage || 'en'
            );
          }
        }
        return { templateSent: true };

      case 'assign_agent':
        let agentId = action.assignTo;

        if (action.assignMethod === 'round_robin' || action.assignMethod === 'least_loaded') {
          // Get available agents
          const agents = await Agent.find({
            business: businessId,
            isActive: true,
            status: { $in: ['online', 'busy'] },
            $expr: { $lt: ['$currentChatCount', '$maxConcurrentChats'] }
          });

          if (agents.length > 0) {
            if (action.assignMethod === 'round_robin') {
              const agentIds = agents.map(a => a._id.toString());
              agentId = await conversationStateService.getNextAgent(businessId, agentIds);
            } else {
              // Least loaded
              agentId = agents.sort((a, b) => a.currentChatCount - b.currentChatCount)[0]._id;
            }
          }
        }

        if (agentId) {
          await Conversation.findByIdAndUpdate(conversationId, {
            assignedAgent: agentId,
            assignedAt: new Date()
          });
          await conversationStateService.assignAgent(businessId, customerPhone, agentId);
        }
        return { assigned: true, agentId };

      case 'set_priority':
        if (action.priority) {
          await Conversation.findByIdAndUpdate(conversationId, {
            priority: action.priority
          });
        }
        return { prioritySet: action.priority };

      case 'add_tag':
        if (action.tagName) {
          await Conversation.findByIdAndUpdate(conversationId, {
            $addToSet: {
              tags: {
                name: action.tagName,
                color: action.tagColor || '#3B82F6',
                addedAt: new Date()
              }
            }
          });
        }
        return { tagAdded: action.tagName };

      case 'remove_tag':
        if (action.tagName) {
          await Conversation.findByIdAndUpdate(conversationId, {
            $pull: { tags: { name: action.tagName } }
          });
        }
        return { tagRemoved: action.tagName };

      case 'change_status':
        if (action.status) {
          await Conversation.findByIdAndUpdate(conversationId, {
            status: action.status
          });
        }
        return { statusChanged: action.status };

      case 'handoff_to_agent':
        await Conversation.findByIdAndUpdate(conversationId, {
          isBotActive: false,
          handoffRequested: true,
          handoffReason: 'automation',
          handoffRequestedAt: new Date()
        });
        await conversationStateService.setConversationState(
          businessId,
          customerPhone,
          conversationStateService.STATES.HANDOFF_TO_AGENT
        );
        await conversationStateService.addToHandoffQueue(businessId, conversationId, 'automation');
        return { handoffRequested: true };

      case 'update_state':
        if (action.newState) {
          await conversationStateService.setConversationState(
            businessId,
            customerPhone,
            action.newState,
            action.stateData || {}
          );
        }
        return { stateUpdated: action.newState };

      case 'create_lead':
        const { Lead } = require('../models');
        const existingLead = await Lead.findOne({
          business: businessId,
          customerPhone
        });
        
        if (!existingLead) {
          await Lead.create({
            business: businessId,
            conversation: conversationId,
            customerPhone,
            source: 'whatsapp',
            status: 'new',
            interest: `Triggered by rule: ${action.tagName || 'automation'}`
          });
        }
        return { leadCreated: true };

      case 'webhook':
        if (action.webhookUrl) {
          const axios = require('axios');
          const response = await axios({
            method: action.webhookMethod || 'POST',
            url: action.webhookUrl,
            headers: action.webhookHeaders || { 'Content-Type': 'application/json' },
            data: {
              ...action.webhookBody,
              businessId,
              conversationId,
              customerPhone
            },
            timeout: 10000
          });
          return { webhookCalled: true, status: response.status };
        }
        return { webhookCalled: false, error: 'No URL provided' };

      default:
        return { unknown: true };
    }
  }

  /**
   * Cooldown management
   */
  isInCooldown(ruleId, cooldownMinutes) {
    if (cooldownMinutes <= 0) return false;
    
    const key = ruleId.toString();
    const cooldownEnd = this.cooldowns.get(key);
    
    if (!cooldownEnd) return false;
    
    if (Date.now() > cooldownEnd) {
      this.cooldowns.delete(key);
      return false;
    }
    
    return true;
  }

  setCooldown(ruleId, cooldownMinutes) {
    const key = ruleId.toString();
    const cooldownEnd = Date.now() + (cooldownMinutes * 60 * 1000);
    this.cooldowns.set(key, cooldownEnd);
  }
}

module.exports = new AutomationRulesEngine();
