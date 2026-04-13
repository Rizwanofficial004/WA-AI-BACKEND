const { aiService } = require('../services');

// @desc    Get all knowledge base items for a business
// @route   GET /api/businesses/:businessId/knowledge
// @access  Private
const getKnowledgeBase = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    const knowledge = await aiService.getKnowledgeBase(req.params.businessId, options);
    
    res.status(200).json({
      success: true,
      count: knowledge.length,
      data: knowledge
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add knowledge base item
// @route   POST /api/businesses/:businessId/knowledge
// @access  Private
const addKnowledge = async (req, res, next) => {
  try {
    const knowledge = await aiService.addKnowledge(req.params.businessId, req.body);
    
    res.status(201).json({
      success: true,
      data: knowledge
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update knowledge base item
// @route   PUT /api/businesses/:businessId/knowledge/:knowledgeId
// @access  Private
const updateKnowledge = async (req, res, next) => {
  try {
    const knowledge = await aiService.updateKnowledge(
      req.params.knowledgeId,
      req.params.businessId,
      req.body
    );
    
    res.status(200).json({
      success: true,
      data: knowledge
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete knowledge base item
// @route   DELETE /api/businesses/:businessId/knowledge/:knowledgeId
// @access  Private
const deleteKnowledge = async (req, res, next) => {
  try {
    const result = await aiService.deleteKnowledge(
      req.params.knowledgeId,
      req.params.businessId
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search knowledge base
// @route   GET /api/businesses/:businessId/knowledge/search
// @access  Private
const searchKnowledge = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const results = await aiService.searchKnowledgeBase(req.params.businessId, q);
    
    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test AI response
// @route   POST /api/businesses/:businessId/ai/test
// @access  Private
const testAIResponse = async (req, res, next) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const result = await aiService.generateResponse(req.params.businessId, message);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getKnowledgeBase,
  addKnowledge,
  updateKnowledge,
  deleteKnowledge,
  searchKnowledge,
  testAIResponse
};