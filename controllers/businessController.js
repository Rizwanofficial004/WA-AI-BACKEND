const { businessService } = require('../services');

// @desc    Create business
// @route   POST /api/businesses
// @access  Private
const createBusiness = async (req, res, next) => {
  try {
    const business = await businessService.createBusiness(req.body, req.user._id);
    
    res.status(201).json({
      success: true,
      data: business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all businesses for current user
// @route   GET /api/businesses
// @access  Private
const getBusinesses = async (req, res, next) => {
  try {
    const businesses = await businessService.getBusinessesByOwner(req.user._id);
    
    res.status(200).json({
      success: true,
      count: businesses.length,
      data: businesses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single business
// @route   GET /api/businesses/:businessId
// @access  Private
const getBusiness = async (req, res, next) => {
  try {
    const business = await businessService.getBusinessById(req.params.businessId);
    
    res.status(200).json({
      success: true,
      data: business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update business
// @route   PUT /api/businesses/:businessId
// @access  Private
const updateBusiness = async (req, res, next) => {
  try {
    const business = await businessService.updateBusiness(
      req.params.businessId,
      req.body,
      req.user._id
    );
    
    res.status(200).json({
      success: true,
      data: business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete business
// @route   DELETE /api/businesses/:businessId
// @access  Private
const deleteBusiness = async (req, res, next) => {
  try {
    const result = await businessService.deleteBusiness(req.params.businessId, req.user._id);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Connect WhatsApp to business
// @route   POST /api/businesses/:businessId/whatsapp/connect
// @access  Private
const connectWhatsApp = async (req, res, next) => {
  try {
    const business = await businessService.connectWhatsApp(
      req.params.businessId,
      req.body,
      req.user._id
    );
    
    res.status(200).json({
      success: true,
      data: business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test WhatsApp connection
// @route   POST /api/businesses/:businessId/whatsapp/test
// @access  Private
const testWhatsAppConnection = async (req, res, next) => {
  try {
    const { testPhoneNumber, testMessage } = req.body;
    
    const business = await businessService.getBusinessById(req.params.businessId);
    
    if (!business.isWhatsAppConnected) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not connected to this business'
      });
    }

    // Get the business-specific credentials
    const credentials = business.whatsappCredentials || {};
    const phoneNumberId = credentials.phoneNumberId || business.whatsappPhoneNumberId;
    
    if (!credentials.token || !phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp credentials not configured for this business'
      });
    }

    // Send test message using business credentials
    const { whatsappService } = require('../services');
    const message = testMessage || 'Hello! This is a test message from your WhatsApp AI Assistant. Your connection is working correctly! 🎉';
    
    const result = await whatsappService.sendTestMessage(credentials.token, phoneNumberId, testPhoneNumber, message);
    
    if (result) {
      res.status(200).json({
        success: true,
        message: 'Test message sent successfully!'
      });
    } else {
      res.status(502).json({
        success: false,
        message: 'Failed to send test message. Please check your credentials.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle AI chatbot for business
// @route   PUT /api/businesses/:businessId/ai/toggle
// @access  Private
const toggleAI = async (req, res, next) => {
  try {
    const business = await businessService.toggleAI(
      req.params.businessId,
      req.body.isEnabled,
      req.user._id
    );
    
    res.status(200).json({
      success: true,
      data: business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update business settings
// @route   PUT /api/businesses/:businessId/settings
// @access  Private
const updateSettings = async (req, res, next) => {
  try {
    const business = await businessService.updateBusinessSettings(
      req.params.businessId,
      req.body,
      req.user._id
    );
    
    res.status(200).json({
      success: true,
      data: business
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get business stats
// @route   GET /api/businesses/:businessId/stats
// @access  Private
const getBusinessStats = async (req, res, next) => {
  try {
    const stats = await businessService.getBusinessStats(req.params.businessId, req.user._id);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBusiness,
  getBusinesses,
  getBusiness,
  updateBusiness,
  deleteBusiness,
  connectWhatsApp,
  testWhatsAppConnection,
  toggleAI,
  updateSettings,
  getBusinessStats
};