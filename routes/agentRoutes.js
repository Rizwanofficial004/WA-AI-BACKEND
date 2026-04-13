const express = require('express');
const router = express.Router();
const { protect, checkBusinessOwnership, checkBusinessAccess } = require('../middlewares/auth');
const { Agent, Conversation } = require('../models');
const handoffService = require('../services/handoffService');
const conversationStateService = require('../services/conversationStateService');

// All routes require authentication
router.use(protect);

// Get all agents for a business
router.get('/:businessId/agents', checkBusinessOwnership, async (req, res) => {
  try {
    const agents = await Agent.find({ business: req.params.businessId })
      .populate('user', 'email firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create agent
router.post('/:businessId/agents', checkBusinessOwnership, async (req, res) => {
  try {
    const { email, name, role, permissions, maxConcurrentChats } = req.body;

    // Check if user with this email exists
    const existingUser = await require('../models').User.findOne({ email: email.toLowerCase() });
    
    if (!existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: `User with email "${email}" not found. Please register this user first, then add them as an agent.`
      });
    }

    // Check if agent already exists for this user
    const existingAgent = await Agent.findOne({ 
      business: req.params.businessId, 
      user: existingUser._id 
    });
    
    if (existingAgent) {
      return res.status(400).json({ 
        success: false, 
        message: 'This user is already an agent in this business.'
      });
    }

    const agent = await Agent.create({
      business: req.params.businessId,
      user: existingUser._id,
      email: existingUser.email,
      name: name || existingUser.firstName || 'Agent',
      role: role || 'agent',
      permissions: permissions || {},
      maxConcurrentChats: maxConcurrentChats || 5,
      status: 'offline'
    });

    res.status(201).json({ 
      success: true, 
      data: agent,
      message: 'Agent added successfully. They can now login with their credentials.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update agent
router.put('/:businessId/agents/:agentId', checkBusinessOwnership, async (req, res) => {
  try {
    const { name, role, permissions, maxConcurrentChats, isActive } = req.body;

    const agent = await Agent.findOneAndUpdate(
      { _id: req.params.agentId, business: req.params.businessId },
      { name, role, permissions, maxConcurrentChats, isActive },
      { new: true }
    );

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete agent
router.delete('/:businessId/agents/:agentId', checkBusinessOwnership, async (req, res) => {
  try {
    const agent = await Agent.findOneAndDelete({
      _id: req.params.agentId,
      business: req.params.businessId
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    res.json({ success: true, message: 'Agent deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update agent status
router.put('/:businessId/agents/:agentId/status', checkBusinessOwnership, async (req, res) => {
  try {
    const { status } = req.body;

    await handoffService.updateAgentStatus(req.params.businessId, req.params.agentId, status);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get agent's conversations
router.get('/:businessId/agents/:agentId/conversations', checkBusinessOwnership, async (req, res) => {
  try {
    const conversations = await handoffService.getAgentConversations(
      req.params.businessId,
      req.params.agentId
    );

    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get handoff queue - both owner and agent can view
router.get('/:businessId/handoff-queue', checkBusinessAccess, async (req, res) => {
  try {
    const queue = await handoffService.getHandoffQueue(req.params.businessId);

    res.json({ success: true, data: queue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get online agents - both owner and agent can view
router.get('/:businessId/agents-online', checkBusinessAccess, async (req, res) => {
  try {
    // Fallback to database query if Redis is not available
    const agents = await Agent.find({
      business: req.params.businessId,
      isActive: true,
      status: { $in: ['online', 'busy'] }
    }).select('name status currentChatCount maxConcurrentChats');

    res.json({ success: true, data: agents });
  } catch (error) {
    console.error('Error getting online agents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign agent to conversation
router.post('/:businessId/conversations/:conversationId/assign', checkBusinessOwnership, async (req, res) => {
  try {
    const { agentId } = req.body;

    const conversation = await handoffService.assignAgent(
      req.params.businessId,
      req.params.conversationId,
      agentId
    );

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Transfer conversation to another agent
router.post('/:businessId/conversations/:conversationId/transfer', checkBusinessOwnership, async (req, res) => {
  try {
    const { toAgentId, reason } = req.body;

    const conversation = await handoffService.transferAgent(
      req.params.businessId,
      req.params.conversationId,
      req.body.fromAgentId,
      toAgentId,
      reason
    );

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Return conversation to bot
router.post('/:businessId/conversations/:conversationId/return-to-bot', checkBusinessOwnership, async (req, res) => {
  try {
    const result = await handoffService.returnToBot(
      req.params.businessId,
      req.params.conversationId
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
