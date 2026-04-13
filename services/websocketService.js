// WebSocket Service for Real-time Updates
// Enables live chat, typing indicators, and notifications

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Agent, Conversation, Message } = require('../models');
const conversationStateService = require('./conversationStateService');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedAgents = new Map(); // agentId -> socket
    this.businessRooms = new Map(); // businessId -> Set of agent sockets
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get agent details
        const agent = await Agent.findOne({ user: decoded.id }).populate('user');
        
        if (!agent) {
          return next(new Error('Agent not found'));
        }

        socket.agent = agent;
        socket.businessId = agent.business.toString();
        socket.agentId = agent._id.toString();
        
        next();
      } catch (error) {
        console.error('[WebSocket] Auth error:', error.message);
        next(new Error('Invalid token'));
      }
    });

    // Handle connections
    this.io.on('connection', (socket) => {
      this._handleConnection(socket);
    });

    console.log('✅ WebSocket server initialized');
    return this.io;
  }

  /**
   * Handle new socket connection
   */
  _handleConnection(socket) {
    const { agentId, businessId } = socket;

    console.log(`[WebSocket] Agent connected: ${socket.agent.name} (${agentId})`);

    // Track connected agent
    this.connectedAgents.set(agentId, socket);
    
    // Join business room
    socket.join(`business:${businessId}`);
    
    // Track in business room set
    if (!this.businessRooms.has(businessId)) {
      this.businessRooms.set(businessId, new Set());
    }
    this.businessRooms.get(businessId).add(socket);

    // Update agent status to online
    this._updateAgentStatus(agentId, 'online');
    conversationStateService.setAgentOnline(businessId, agentId);

    // Emit online agents to room
    this._emitOnlineAgents(businessId);

    // =====================
    // EVENT HANDLERS
    // =====================

    // Join conversation room
    socket.on('join:conversation', async (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[WebSocket] Agent joined conversation: ${conversationId}`);
      
      // Mark messages as read
      await this._markMessagesAsRead(conversationId, agentId);
    });

    // Leave conversation room
    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`[WebSocket] Agent left conversation: ${conversationId}`);
    });

    // Typing indicator
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:indicator', {
        conversationId,
        agentId,
        agentName: socket.agent.name,
        isTyping: true
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:indicator', {
        conversationId,
        agentId,
        agentName: socket.agent.name,
        isTyping: false
      });
    });

    // Agent status change
    socket.on('status:update', async (status) => {
      await this._updateAgentStatus(agentId, status);
      this._emitOnlineAgents(businessId);
    });

    // Handoff request accept
    socket.on('handoff:accept', async ({ conversationId }) => {
      await this._acceptHandoff(businessId, conversationId, agentId, socket);
    });

    // Send message
    socket.on('message:send', async ({ conversationId, content, messageType = 'text' }) => {
      await this._handleAgentMessage(businessId, conversationId, agentId, content, messageType, socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
      this._handleDisconnect(socket);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('[WebSocket] Socket error:', error);
    });
  }

  /**
   * Handle disconnect
   */
  _handleDisconnect(socket) {
    const { agentId, businessId } = socket;

    console.log(`[WebSocket] Agent disconnected: ${socket.agent?.name} (${agentId})`);

    // Remove from connected agents
    this.connectedAgents.delete(agentId);
    
    // Remove from business room set
    const businessRoom = this.businessRooms.get(businessId);
    if (businessRoom) {
      businessRoom.delete(socket);
    }

    // Update agent status to offline
    this._updateAgentStatus(agentId, 'offline');
    conversationStateService.setAgentOffline(businessId, agentId);

    // Emit updated online agents
    this._emitOnlineAgents(businessId);
  }

  /**
   * Update agent status
   */
  async _updateAgentStatus(agentId, status) {
    try {
      await Agent.findByIdAndUpdate(agentId, {
        status,
        lastActive: new Date()
      });
    } catch (error) {
      console.error('[WebSocket] Error updating agent status:', error);
    }
  }

  /**
   * Emit online agents to business room
   */
  async _emitOnlineAgents(businessId) {
    try {
      const onlineAgents = await Agent.find({
        business: businessId,
        status: { $in: ['online', 'busy', 'away'] }
      }).select('name status currentChatCount');

      this.io.to(`business:${businessId}`).emit('agents:online', onlineAgents);
    } catch (error) {
      console.error('[WebSocket] Error emitting online agents:', error);
    }
  }

  /**
   * Mark messages as read
   */
  async _markMessagesAsRead(conversationId, agentId) {
    try {
      await Message.updateMany(
        { conversation: conversationId, sender: 'customer', 'metadata.status': { $ne: 'read' } },
        { $set: { 'metadata.status': 'read' } }
      );

      await Conversation.findByIdAndUpdate(conversationId, { unreadCount: 0 });
    } catch (error) {
      console.error('[WebSocket] Error marking messages as read:', error);
    }
  }

  /**
   * Accept handoff
   */
  async _acceptHandoff(businessId, conversationId, agentId, socket) {
    try {
      const handoffService = require('./handoffService');
      const conversation = await handoffService.assignAgent(businessId, conversationId, agentId);

      if (conversation) {
        // Join conversation room
        socket.join(`conversation:${conversationId}`);

        // Emit to conversation room
        this.io.to(`conversation:${conversationId}`).emit('handoff:accepted', {
          conversationId,
          agentId,
          agentName: socket.agent.name
        });

        // Emit to business room
        this.io.to(`business:${businessId}`).emit('handoff:removed', { conversationId });

        console.log(`[WebSocket] Handoff accepted: ${conversationId} by ${socket.agent.name}`);
      }
    } catch (error) {
      console.error('[WebSocket] Error accepting handoff:', error);
      socket.emit('error', { message: 'Failed to accept handoff' });
    }
  }

  /**
   * Handle agent message
   */
  async _handleAgentMessage(businessId, conversationId, agentId, content, messageType, socket) {
    try {
      // Create message
      const message = await Message.create({
        conversation: conversationId,
        business: businessId,
        sender: 'agent',
        content,
        messageType,
        metadata: {
          agentId,
          timestamp: new Date()
        }
      });

      // Update conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessageAt: new Date(),
        lastMessageBy: 'agent',
        $inc: { messageCount: 1 },
        lastCustomerMessage: content.substring(0, 100)
      });

      // Get WhatsApp service to send message
      const whatsappService = require('./whatsappService');
      const conversation = await Conversation.findById(conversationId);
      
      if (conversation) {
        const { Business } = require('../models');
        const business = await Business.findById(businessId);
        
        if (business) {
          const wa = await whatsappService.sendMessage(business, conversation.customerPhone, content);
          if (!wa) {
            throw new Error('WhatsApp delivery failed');
          }
        }
      }

      // Emit message to conversation room
      this.io.to(`conversation:${conversationId}`).emit('message:new', {
        conversationId,
        message: {
          ...message.toObject(),
          sender: 'agent',
          agentName: socket.agent.name
        }
      });

      // Emit to business room for dashboard update
      this.io.to(`business:${businessId}`).emit('conversation:updated', {
        conversationId,
        lastMessage: content.substring(0, 100),
        lastMessageAt: new Date()
      });

    } catch (error) {
      console.error('[WebSocket] Error handling agent message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  // =====================
  // PUBLIC METHODS (for use by other services)
  // =====================

  /**
   * Notify new customer message
   */
  notifyNewMessage(businessId, conversationId, message, conversation) {
    if (!this.io) return;

    // Emit to business room
    this.io.to(`business:${businessId}`).emit('message:new', {
      conversationId,
      message,
      conversation
    });

    // If conversation has assigned agent, emit specifically to them
    if (conversation.assignedAgent) {
      const agentSocket = this.connectedAgents.get(conversation.assignedAgent.toString());
      if (agentSocket) {
        agentSocket.emit('message:customer', {
          conversationId,
          message
        });
      }
    }

    // Emit conversation update
    this.io.to(`business:${businessId}`).emit('conversation:updated', {
      conversationId,
      lastMessage: message.content?.substring(0, 100),
      lastMessageAt: new Date(),
      unreadCount: (conversation.unreadCount || 0) + 1
    });
  }

  /**
   * Notify new handoff request
   */
  notifyHandoffRequest(businessId, conversationId, conversation) {
    if (!this.io) return;

    this.io.to(`business:${businessId}`).emit('handoff:new', {
      conversationId,
      conversation
    });
  }

  /**
   * Notify new lead
   */
  notifyNewLead(businessId, lead) {
    if (!this.io) return;

    this.io.to(`business:${businessId}`).emit('lead:new', lead);
  }

  /**
   * Notify new order
   */
  notifyNewOrder(businessId, order) {
    if (!this.io) return;

    this.io.to(`business:${businessId}`).emit('order:new', order);
  }

  /**
   * Broadcast notification to all agents of a business
   */
  broadcastToBusiness(businessId, event, data) {
    if (!this.io) return;

    this.io.to(`business:${businessId}`).emit(event, data);
  }

  /**
   * Get connected agents count
   */
  getConnectedAgentsCount(businessId) {
    const room = this.businessRooms.get(businessId);
    return room ? room.size : 0;
  }
}

module.exports = new WebSocketService();
