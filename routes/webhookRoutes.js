const express = require('express');
const router = express.Router();
const { webhookController } = require('../controllers');
const { protect, webhookRateLimiter } = require('../middlewares');

// WhatsApp webhook verification (GET request from Meta)
router.get('/whatsapp', webhookController.verifyWebhook);

// WhatsApp webhook message handler (POST request from Meta)
router.post('/whatsapp', webhookRateLimiter, webhookController.handleWebhook);

module.exports = router;