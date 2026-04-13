const { conversationService } = require('../services');

// @desc    Get all conversations for a business
// @route   GET /api/businesses/:businessId/conversations
// @access  Private
const getConversations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    const conversations = await conversationService.getConversationsByBusiness(
      req.params.businessId,
      options
    );
    
    const total = await conversationService.getConversationsByBusiness(req.params.businessId);

    res.status(200).json({
      success: true,
      count: conversations.length,
      total: total.length,
      page: parseInt(page),
      pages: Math.ceil(total.length / parseInt(limit)),
      data: conversations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single conversation with messages
// @route   GET /api/businesses/:businessId/conversations/:conversationId
// @access  Private
const getConversation = async (req, res, next) => {
  try {
    const data = await conversationService.getConversationWithMessages(
      req.params.conversationId,
      req.params.businessId
    );
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update conversation status
// @route   PUT /api/businesses/:businessId/conversations/:conversationId/status
// @access  Private
const updateConversationStatus = async (req, res, next) => {
  try {
    const conversation = await conversationService.updateConversationStatus(
      req.params.conversationId,
      req.params.businessId,
      req.body.status
    );
    
    res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation stats
// @route   GET /api/businesses/:businessId/conversations/stats
// @access  Private
const getConversationStats = async (req, res, next) => {
  try {
    const stats = await conversationService.getConversationStats(req.params.businessId);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create lead from conversation
// @route   POST /api/businesses/:businessId/conversations/:conversationId/lead
// @access  Private
const createLeadFromConversation = async (req, res, next) => {
  try {
    const lead = await conversationService.createLeadFromConversation(
      req.params.conversationId,
      req.params.businessId,
      req.body
    );
    
    res.status(201).json({
      success: true,
      data: lead
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getConversation,
  updateConversationStatus,
  getConversationStats,
  createLeadFromConversation
};