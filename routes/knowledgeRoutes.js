const express = require('express');
const router = express.Router();
const { knowledgeController } = require('../controllers');
const { protect, addKnowledgeValidation } = require('../middlewares');
const { knowledgeBaseService, businessService } = require('../services');

// Knowledge base routes (nested under business)
router.get('/:businessId/knowledge', protect, knowledgeController.getKnowledgeBase);
router.post('/:businessId/knowledge', protect, addKnowledgeValidation, knowledgeController.addKnowledge);
router.get('/:businessId/knowledge/search', protect, knowledgeController.searchKnowledge);
router.put('/:businessId/knowledge/:knowledgeId', protect, knowledgeController.updateKnowledge);
router.delete('/:businessId/knowledge/:knowledgeId', protect, knowledgeController.deleteKnowledge);

// Seed knowledge base with default data based on business type
router.post('/:businessId/knowledge/seed', protect, async (req, res) => {
  try {
    const business = await businessService.getBusinessById(req.params.businessId);
    const businessType = business.businessType || 'other';
    const result = await knowledgeBaseService.seedKnowledgeBase(req.params.businessId, businessType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// AI test endpoint
router.post('/:businessId/ai/test', protect, knowledgeController.testAIResponse);

module.exports = router;