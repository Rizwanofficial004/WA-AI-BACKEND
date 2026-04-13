// Conversation State Management — Redis with in-memory fallback

const { getRedis } = require('../config/redis');

const STATE_TTL = 24 * 60 * 60;
const ORDER_SESSION_TTL = 2 * 60 * 60;

class ConversationStateService {
  
  constructor() {
    this._memStore = new Map();
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

  _key(type, businessId, identifier = '') {
    return `${this.REDIS_KEYS[type]}${businessId}:${identifier}`;
  }

  _redis() { return getRedis(); }

  async _set(key, value, ttl) {
    const r = this._redis();
    if (r) { await r.setex(key, ttl, value); }
    else { this._memStore.set(key, value); }
  }
  async _get(key) {
    const r = this._redis();
    if (r) return await r.get(key);
    return this._memStore.get(key) || null;
  }
  async _del(key) {
    const r = this._redis();
    if (r) { await r.del(key); }
    else { this._memStore.delete(key); }
  }
  async _incr(key) {
    const r = this._redis();
    if (r) return await r.incr(key);
    const v = (parseInt(this._memStore.get(key)) || 0) + 1;
    this._memStore.set(key, String(v));
    return v;
  }
  async _sadd(key, val) {
    const r = this._redis();
    if (r) { await r.sadd(key, val); await r.expire(key, STATE_TTL); return; }
    const s = this._memStore.get(key) || new Set();
    s.add(val);
    this._memStore.set(key, s);
  }
  async _srem(key, val) {
    const r = this._redis();
    if (r) { await r.srem(key, val); return; }
    const s = this._memStore.get(key);
    if (s) s.delete(val);
  }
  async _smembers(key) {
    const r = this._redis();
    if (r) return await r.smembers(key);
    const s = this._memStore.get(key);
    return s instanceof Set ? [...s] : [];
  }
  async _sismember(key, val) {
    const r = this._redis();
    if (r) return await r.sismember(key, val);
    const s = this._memStore.get(key);
    return s instanceof Set ? s.has(val) : false;
  }
  async _lpush(key, val) {
    const r = this._redis();
    if (r) { await r.lpush(key, val); await r.expire(key, STATE_TTL); return; }
    const arr = this._memStore.get(key) || [];
    arr.unshift(val);
    this._memStore.set(key, arr);
  }
  async _lrange(key, start, stop) {
    const r = this._redis();
    if (r) return await r.lrange(key, start, stop);
    const arr = this._memStore.get(key) || [];
    return stop === -1 ? arr.slice(start) : arr.slice(start, stop + 1);
  }
  async _lrem(key, count, val) {
    const r = this._redis();
    if (r) { await r.lrem(key, count, val); return; }
    const arr = this._memStore.get(key) || [];
    const idx = arr.indexOf(val);
    if (idx !== -1) arr.splice(idx, 1);
  }
  async _exists(key) {
    const r = this._redis();
    if (r) return await r.exists(key);
    return this._memStore.has(key) ? 1 : 0;
  }
  async _setnx(key, val, ttl) {
    const r = this._redis();
    if (r) return await r.set(key, val, 'EX', ttl, 'NX');
    if (this._memStore.has(key)) return null;
    this._memStore.set(key, val);
    return 'OK';
  }

  // =====================
  // CONVERSATION STATE
  // =====================
  
  async setConversationState(businessId, phone, state, data = {}) {
    const key = this._key('CONVERSATION_STATE', businessId, phone);
    const stateData = { state, data, updatedAt: new Date().toISOString() };
    await this._set(key, JSON.stringify(stateData), STATE_TTL);
    return stateData;
  }

  async getConversationState(businessId, phone) {
    const key = this._key('CONVERSATION_STATE', businessId, phone);
    const data = await this._get(key);
    if (!data) return { state: 'idle', data: {} };
    return JSON.parse(data);
  }

  async clearConversationState(businessId, phone) {
    const key = this._key('CONVERSATION_STATE', businessId, phone);
    await this._del(key);
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
    const session = { ...sessionData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this._set(key, JSON.stringify(session), ORDER_SESSION_TTL);
    return session;
  }

  async getOrderSession(businessId, phone) {
    const key = this._key('ORDER_SESSION', businessId, phone);
    const data = await this._get(key);
    return data ? JSON.parse(data) : null;
  }

  async updateOrderSession(businessId, phone, updates) {
    const session = await this.getOrderSession(businessId, phone);
    if (!session) return null;
    const updatedSession = { ...session, ...updates, updatedAt: new Date().toISOString() };
    const key = this._key('ORDER_SESSION', businessId, phone);
    await this._set(key, JSON.stringify(updatedSession), ORDER_SESSION_TTL);
    return updatedSession;
  }

  async clearOrderSession(businessId, phone) {
    const key = this._key('ORDER_SESSION', businessId, phone);
    await this._del(key);
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
    await this._set(key, agentId, STATE_TTL);
    return agentId;
  }

  async getAssignedAgent(businessId, phone) {
    const key = this._key('AGENT_ASSIGNMENT', businessId, phone);
    return await this._get(key);
  }

  async clearAgentAssignment(businessId, phone) {
    const key = this._key('AGENT_ASSIGNMENT', businessId, phone);
    await this._del(key);
  }

  async getNextAgent(businessId, agentIds) {
    if (!agentIds || agentIds.length === 0) return null;
    const key = this._key('ROUND_ROBIN', businessId, '');
    const index = await this._incr(key);
    if (index >= agentIds.length * 1000) {
      const r = this._redis();
      if (r) await r.set(key, '0'); else this._memStore.set(key, '0');
      return agentIds[0];
    }
    return agentIds[index % agentIds.length];
  }

  async setAgentOnline(businessId, agentId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    await this._sadd(key, agentId);
  }

  async setAgentOffline(businessId, agentId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    await this._srem(key, agentId);
  }

  async getOnlineAgents(businessId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    return await this._smembers(key);
  }

  async isAgentOnline(businessId, agentId) {
    const key = this._key('ONLINE_AGENTS', businessId, '');
    return await this._sismember(key, agentId);
  }

  // =====================
  // HANDOFF QUEUE
  // =====================

  async addToHandoffQueue(businessId, conversationId, reason) {
    const key = this._key('HANDOFF_QUEUE', businessId, '');
    const item = JSON.stringify({ conversationId, reason, requestedAt: new Date().toISOString() });
    await this._lpush(key, item);
  }

  async getHandoffQueue(businessId) {
    const key = this._key('HANDOFF_QUEUE', businessId, '');
    const items = await this._lrange(key, 0, -1);
    return items.map(item => JSON.parse(item));
  }

  async removeFromHandoffQueue(businessId, conversationId) {
    const key = this._key('HANDOFF_QUEUE', businessId, '');
    const items = await this._lrange(key, 0, -1);
    for (const item of items) {
      const parsed = JSON.parse(item);
      if (parsed.conversationId === conversationId) {
        await this._lrem(key, 1, item);
        break;
      }
    }
  }

  // =====================
  // TYPING INDICATOR
  // =====================

  async setTypingIndicator(businessId, phone, isTyping = true) {
    const key = this._key('TYPING_INDICATOR', businessId, phone);
    if (isTyping) { await this._set(key, '1', 30); }
    else { await this._del(key); }
  }

  async isTyping(businessId, phone) {
    const key = this._key('TYPING_INDICATOR', businessId, phone);
    return await this._exists(key);
  }

  // =====================
  // UNREAD COUNT
  // =====================

  async incrementUnread(businessId, agentId) {
    const key = `${this.REDIS_KEYS.UNREAD_COUNT}${businessId}:${agentId}`;
    return await this._incr(key);
  }

  async resetUnread(businessId, agentId) {
    const key = `${this.REDIS_KEYS.UNREAD_COUNT}${businessId}:${agentId}`;
    const r = this._redis();
    if (r) await r.set(key, '0'); else this._memStore.set(key, '0');
  }

  async getUnreadCount(businessId, agentId) {
    const key = `${this.REDIS_KEYS.UNREAD_COUNT}${businessId}:${agentId}`;
    const count = await this._get(key);
    return parseInt(count) || 0;
  }

  // =====================
  // CONVERSATION LOCK (prevent race conditions)
  // =====================

  async acquireLock(businessId, phone, ttl = 10) {
    const key = this._key('CONVERSATION_LOCK', businessId, phone);
    const result = await this._setnx(key, '1', ttl);
    return result === 'OK';
  }

  async releaseLock(businessId, phone) {
    const key = this._key('CONVERSATION_LOCK', businessId, phone);
    await this._del(key);
  }

  // =====================
  // BROADCAST RATE LIMITING
  // =====================

  async checkBroadcastRate(businessId, limitPerMinute = 50) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${this.REDIS_KEYS.BROADCAST_RATE}${businessId}:${minute}`;
    const count = await this._incr(key);
    return count <= limitPerMinute;
  }

  async getBroadcastRate(businessId) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${this.REDIS_KEYS.BROADCAST_RATE}${businessId}:${minute}`;
    const count = await this._get(key);
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
