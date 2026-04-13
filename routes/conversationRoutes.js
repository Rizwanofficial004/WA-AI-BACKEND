const express = require('express');
const router = express.Router();
const { conversationController } = require('../controllers');
const { protect, checkBusinessAccess, updateConversationValidation } = require('../middlewares');

// Conversation routes (nested under business)
// Both owner and agent can access conversations
router.get('/:businessId/conversations', protect, checkBusinessAccess, conversationController.getConversations);
router.get('/:businessId/conversations/stats', protect, checkBusinessAccess, conversationController.getConversationStats);
router.get('/:businessId/conversations/:conversationId', protect, checkBusinessAccess, conversationController.getConversation);
router.put('/:businessId/conversations/:conversationId/status', protect, checkBusinessAccess, updateConversationValidation, conversationController.updateConversationStatus);
router.post('/:businessId/conversations/:conversationId/lead', protect, checkBusinessAccess, conversationController.createLeadFromConversation);

module.exports = router;