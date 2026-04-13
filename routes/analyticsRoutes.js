const express = require('express');
const router = express.Router();
const { protect, checkBusinessOwnership } = require('../middlewares/auth');
const analyticsService = require('../services/analyticsService');

// All routes require authentication
router.use(protect);

// Get dashboard analytics
router.get('/:businessId/analytics/dashboard', checkBusinessOwnership, async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;

    const analytics = await analyticsService.getDashboardAnalytics(req.params.businessId, {
      startDate,
      endDate,
      period
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get conversation analytics
router.get('/:businessId/analytics/conversations', checkBusinessOwnership, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await analyticsService.getConversationAnalytics(req.params.businessId, {
      startDate,
      endDate
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get lead analytics
router.get('/:businessId/analytics/leads', checkBusinessOwnership, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await analyticsService.getLeadAnalytics(req.params.businessId, {
      startDate,
      endDate
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get order analytics
router.get('/:businessId/analytics/orders', checkBusinessOwnership, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await analyticsService.getOrderAnalytics(req.params.businessId, {
      startDate,
      endDate
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get AI usage analytics
router.get('/:businessId/analytics/ai', checkBusinessOwnership, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const analytics = await analyticsService.getAIAnalytics(req.params.businessId, {
      startDate,
      endDate
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Trigger analytics recording (admin only)
router.post('/:businessId/analytics/record', checkBusinessOwnership, async (req, res) => {
  try {
    const { date } = req.body;

    const analytics = await analyticsService.recordDailyAnalytics(
      req.params.businessId,
      date ? new Date(date) : new Date()
    );

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
