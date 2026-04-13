const express = require('express');
const router = express.Router();
const { protect, checkBusinessOwnership } = require('../middlewares/auth');
const broadcastService = require('../services/broadcastService');

// All routes require authentication
router.use(protect);

// Get all broadcasts
router.get('/:businessId/broadcasts', checkBusinessOwnership, async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    
    const result = await broadcastService.getBroadcasts(req.params.businessId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single broadcast
router.get('/:businessId/broadcasts/:broadcastId', checkBusinessOwnership, async (req, res) => {
  try {
    const stats = await broadcastService.getBroadcastStats(
      req.params.businessId,
      req.params.broadcastId
    );

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create broadcast
router.post('/:businessId/broadcasts', checkBusinessOwnership, async (req, res) => {
  try {
    const broadcast = await broadcastService.createBroadcast(req.params.businessId, {
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start broadcast
router.post('/:businessId/broadcasts/:broadcastId/start', checkBusinessOwnership, async (req, res) => {
  try {
    const result = await broadcastService.startBroadcast(
      req.params.businessId,
      req.params.broadcastId
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Schedule broadcast
router.post('/:businessId/broadcasts/:broadcastId/schedule', checkBusinessOwnership, async (req, res) => {
  try {
    const { scheduledAt } = req.body;

    const broadcast = await broadcastService.scheduleBroadcast(
      req.params.businessId,
      req.params.broadcastId,
      new Date(scheduledAt)
    );

    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel broadcast
router.post('/:businessId/broadcasts/:broadcastId/cancel', checkBusinessOwnership, async (req, res) => {
  try {
    const broadcast = await broadcastService.cancelBroadcast(
      req.params.businessId,
      req.params.broadcastId
    );

    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete broadcast
router.delete('/:businessId/broadcasts/:broadcastId', checkBusinessOwnership, async (req, res) => {
  try {
    const { Broadcast } = require('../models');
    
    const broadcast = await Broadcast.findOneAndDelete({
      _id: req.params.broadcastId,
      business: req.params.businessId,
      status: { $in: ['draft', 'scheduled'] }
    });

    if (!broadcast) {
      return res.status(404).json({ 
        success: false, 
        message: 'Broadcast not found or cannot be deleted' 
      });
    }

    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get target preview (how many recipients)
router.post('/:businessId/broadcasts/target-preview', checkBusinessOwnership, async (req, res) => {
  try {
    const phones = await broadcastService.getTargetPhones(
      req.params.businessId,
      req.body.target
    );

    res.json({ success: true, count: phones.length, phones: phones.slice(0, 10) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
