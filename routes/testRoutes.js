const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// @desc    Test AI response (no auth required for testing)
// @route   POST /api/test/ai
router.post('/ai', async (req, res) => {
  try {
    const { message, businessId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Use provided businessId or create a test one
    const testBusinessId = businessId || '000000000000000000000001';
    
    const result = await aiService.generateResponse(testBusinessId, message);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: 'AI test response',
      error: error.message,
      note: 'AI service is configured. Create a business and add knowledge base items to test full functionality.'
    });
  }
});

// @desc    Simulate incoming webhook (for testing)
// @route   POST /api/test/webhook
router.post('/webhook', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    const mockWebhook = {
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messages: [{
              from: phone,
              type: 'text',
              text: { body: message || 'Hello, I need help!' },
              timestamp: Date.now().toString(),
              id: 'test_' + Date.now()
            }],
            contacts: [{
              profile: { name: 'Test User' }
            }],
            metadata: {
              phone_number_id: '796308443563112'
            }
          }
        }]
      }]
    };

    const whatsappService = require('../services/whatsappService');
    await whatsappService.processWebhook(mockWebhook);
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed (simulated)'
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: 'Test webhook processed',
      error: error.message
    });
  }
});

module.exports = router;