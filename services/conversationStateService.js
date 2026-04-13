// Redis-based Conversation State Management
// Replaces in-memory session storage with Redis for scalability

const { getRedis } = require('../config/redis');

// TTL for conversation states (24 hours)
const STATE_TTL = 24 * 60 * 60;

// TTL for order sessions (2 hours)
const ORDER_SESSION_TTL = 2 * 60 * 60;

class ConversationStateService {
  
  constructor() {
    this.REDIS_KEYS = {
      CONVERSATION_STATE: 'conv:state:',      // conv:state:{businessId}:{phone}
      ORDER_SESSION: 'order:session:',         // order:session:{businessId}:{phone}
      AGENT_ASSIGNMENT: 'agent:assign:',       // agent:assign:{businessId}:{phone}
      HANDOFF_QUEUE: 'handoff:queue:',         // handoff:queue:{businessId}
      ROUND_ROBIN: 'agent:rr:',               // agent:rr:{businessId}
      BROADCAST_RATE: 'broadcast:rate:',       // broadcast:rate:{businessId}:{minute}
      ONLINE_AGENTS: 'agents:online:',         // agents:online:{businessId}
      CONVERSATION_LOCK: 'conv:lock:',         // conv:lock:{businessId}:{phone}
      TYPING_INDICATOR: 'typing:',             // typing:{businessId}:{phone}
      UNREAD_COUNT: 'unread:',                 // unread:{businessId}:{agentId}
    };
  }

  // Generate Redis key
  _key(type, businessId, identifier = '') {
    return `${this.REDIS_KEYS[type]}${businessId}:${identifier}`;
  }

  // =====================
  // CONVERSATION STATE
  // =====================
  
  async setConversationState(businessId, phone, state, data = {}) {
    const key = this._key('CONVERSATION_STATE', businessId, phone);
    const stateData = {
      state,
      data,
      updatedAt: new Date().toISOString()
    };
    
    await getRedis().setex(key, STATE_TTL, JSON.stringify(stateData));
    return stateData;
  }

  async getConversationState(businessId, phone) {
    const key = this._key('CONVERSATION_STATE', businessId, phone);
    const data = await getRedis().get(key);
    
    if (!data) {
      return { state: 'idle', data: {} };
    }
    
    return JSON.parse(data);
  }

  async clearConversationState(businessId, phone) {
    const key = this._key('CONVERSATION_STATE', businessId, phone);
    await getRedis().del(key);
  }

  async isState(businessId, phone, state) {
    const currentState = await this.getConversationState(businessId, phone);
    return currentState.state === state;
  }

  // =====================
  // ORDER SESSION
  // =====================

  async createOrderSession(businessId, phone, sessionData) {
    const key = this._key('ORDER_SESSION', businessId, phone);
    const session = {
      ...sessionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await getRedis().setex(key, ORDER_SESSION_TTL, JSON.stringify(session));
    return session;
  }

  async getOrderSession(businessId, phone) {
    const key = this._key('ORDER_SESSION', businessId, phone);
    const data = await getRedis().get(key);
    
    return data ? JSON.parse(data) : null;
  }

  async updateOrderSession(businessId, phone, updates) {
    const session = await this.getOrderSession(businessId, phone);
    
    if (!session) {
      return null;
    }
    
    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const key = this._key('ORDER_SESSION', businessId, phone);
    await getRedis().setex(key, ORDER_SESSION_TTL, JSON.stringify(updatedSession));
    
    return updatedSession;
  }

  async clearOrderSession(businessId, phone) {
    const key = this._key('ORDER_SESSION', businessId, phone);
    await getRedis().del(key);
  }

  async isInOrderFlow(businessId, phone) {
    const session = await this.getOrderSession(businessId, phone);
    return session !== null && session.state !== 'completed';
  }

  // =====================
  // AGENT ASSIGNMENT
  // =====================

  async assignAgent(businessId, phone, agentId) {
    const key = this._key('AGENT_ASSIGNMENT', businessId, phone);
    await getRedis().setex(key, STATE_TTL, agentId);
    return agentId;
  }

  async getAssignedAgent(businessId, phone) {
    const key = this._key('AGENT_ASSIGNMENT', businessId, phone);
    return await getRedis().get(key);
  }

  async clearAgentAssignment(businessId, phone) {
    const key = this._key('AGENT_ASSIGNMENT', businessId, phone);
    await getRedis().del(key);
  }

  // Round-robin agent assignment
  async getNextAgent(businessId, agentIds) {
    if (!agentIds || agentIds.length === 0) return null;
    
    const key = this._key('ROUND_ROBIN', businessId, '');
    const index = await getRedis().incr(key);
    
    // Wrap around
    if (index >= agentIds.length * 1000) {
      await getRedis().set(key, '0');
      return agentIds[0];
    }
    
    return agentIds[index % agentIds.length];
  }

  // Track online agents
  async setAgentOnline(businessId, agentId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    await getRedis().sadd(key, agentId);
    await getRedis().expire(key, STATE_TTL);
  }

  async setAgentOffline(businessId, agentId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    await getRedis().srem(key, agentId);
  }

  async getOnlineAgents(businessId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    return await getRedis().smembers(key);
  }

  async isAgentOnline(businessId, agentId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    return await getRedis().sismember(key, agentId);
  }

  // =====================
  // HANDOFF QUEUE
  // =====================

  async addToHandoffQueue(businessId, conversationId, reason) {
    const key = this._key('HANDOFF_QUEUE', businessId, '');
    const item = JSON.stringify({
      conversationId,
      reason,
      requestedAt: new Date().toISOString()
    });
    await getRedis().lpush(key, item);
    await getRedis().expire(key, STATE_TTL);
  }

  async getHandoffQueue(businessId) {
    const key = this._key('HANDOFF_QUEUE', businessId, '');
    const items = await getRedis().lrange(key, 0, -1);
    return items.map(item => JSON.parse(item));
  }

  async removeFromHandoffQueue(businessId, conversationId) {
    const key = this._key('HANDOFF_QUEUE', businessId, '');
    const items = await getRedis().lrange(key, 0, -1);
    
    for (const item of items) {
      const parsed = JSON.parse(item);
      if (parsed.conversationId === conversationId) {
        await getRedis().lrem(key, 1, item);
        break;
      }
    }
  }

  // =====================
  // TYPING INDICATOR
  // =====================

  async setTypingIndicator(businessId, phone, isTyping = true) {
    const key = this._key('TYPING_INDICATOR', businessId, phone);
    
    if (isTyping) {
      await getRedis().setex(key, 30, '1'); // Auto-expire in 30 seconds
    } else {
      await getRedis().del(key);
    }
  }

  async isTyping(businessId, phone) {
    const key = this._key('TYPING_INDICATOR', businessId, phone);
    return await getRedis().exists(key);
  }

  // =====================
  // UNREAD COUNT
  // =====================

  async incrementUnread(businessId, agentId) {
    const key = `${this.REDIS_KEYS.UNREAD_COUNT}${businessId}:${agentId}`;
    return await getRedis().incr(key);
  }

  async resetUnread(businessId, agentId) {
    const key = `${this.REDIS_KEYS.UNREAD_COUNT}${businessId}:${agentId}`;
    await getRedis().set(key, '0');
  }

  async getUnreadCount(businessId, agentId) {
    const key = `${this.REDIS_KEYS.UNREAD_COUNT}${businessId}:${agentId}`;
    const count = await getRedis().get(key);
    return parseInt(count) || 0;
  }

  // =====================
  // CONVERSATION LOCK (prevent race conditions)
  // =====================

  async acquireLock(businessId, phone, ttl = 10) {
    const key = this._key('CONVERSATION_LOCK', businessId, phone);
    const result = await getRedis().set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(businessId, phone) {
    const key = this._key('CONVERSATION_LOCK', businessId, phone);
    await getRedis().del(key);
  }

  // =====================
  // BROADCAST RATE LIMITING
  // =====================

  async checkBroadcastRate(businessId, limitPerMinute = 50) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${this.REDIS_KEYS.BROADCAST_RATE}${businessId}:${minute}`;
    
    const count = await getRedis().incr(key);
    
    if (count === 1) {
      await getRedis().expire(key, 60);
    }
    
    return count <= limitPerMinute;
  }

  async getBroadcastRate(businessId) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${this.REDIS_KEYS.BROADCAST_RATE}${businessId}:${minute}`;
    const count = await getRedis().get(key);
    return parseInt(count) || 0;
  }

  // =====================
  // CONVERSATION STATES CONSTANTS
  // =====================
  
  static STATES = {
    IDLE: 'idle',
    WAITING_FOR_ORDER_ID: 'waiting_for_order_id',
    PLACING_ORDER: 'placing_order',
    LEAD_CAPTURE: 'lead_capture',
    SUPPORT_REQUEST: 'support_request',
    HANDOFF_TO_AGENT: 'handoff_to_agent',
    AWAITING_RESPONSE: 'awaiting_response'
  };
}

module.exports = new ConversationStateService();
