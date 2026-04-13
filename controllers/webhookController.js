const { whatsappService } = require('../services');

// @desc    WhatsApp webhook verification
// @route   GET /webhook/whatsapp
// @access  Public
const verifyWebhook = async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  try {
    const verified = await whatsappService.verifyWebhook(mode, token, challenge);
    
    if (verified) {
      console.log('Webhook verified successfully');
      return res.status(200).send(verified);
    } else {
      console.log('Webhook verification failed');
      return res.sendStatus(403);
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    return res.sendStatus(500);
  }
};

// @desc    WhatsApp webhook message handler
// @route   POST /webhook/whatsapp
// @access  Public
const handleWebhook = async (req, res) => {
  try {
    // Log the incoming webhook for debugging
    console.log('WhatsApp Webhook received:', JSON.stringify(req.body, null, 2));

    // Verify the webhook signature (for production)
    // const signature = req.headers['x-hub-signature-256'];
    // if (!verifySignature(req.body, signature)) {
    //   return res.sendStatus(401);
    // }

    // Process the webhook asynchronously
    await whatsappService.processWebhook(req.body);

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still respond with 200 to prevent retries from WhatsApp
    res.status(200).json({ success: false, error: error.message });
  }
};

// @desc    Send test message
// @route   POST /api/businesses/:businessId/whatsapp/send
// @access  Private
const sendTestMessage = async (req, res, next) => {
  try {
    const { business } = req;
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }

    const result = await whatsappService.sendMessage(business, phoneNumber, message);

    if (!result) {
      return res.status(502).json({
        success: false,
        message:
          'WhatsApp did not accept the message. Please check your WhatsApp credentials in business settings.'
      });
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get business conversations via WhatsApp
// @route   GET /api/businesses/:businessId/whatsapp/conversations
// @access  Private
const getWhatsAppConversations = async (req, res, next) => {
  try {
    const conversations = await whatsappService.getBusinessConversations(req.params.businessId);
    
    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation messages
// @route   GET /api/businesses/:businessId/whatsapp/conversations/:conversationId/messages
// @access  Private
const getConversationMessages = async (req, res, next) => {
  try {
    const messages = await whatsappService.getConversationMessages(
      req.params.conversationId,
      req.params.businessId
    );
    
    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook,
  sendTestMessage,
  getWhatsAppConversations,
  getConversationMessages
};