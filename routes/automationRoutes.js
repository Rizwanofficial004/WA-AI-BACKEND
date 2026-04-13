const express = require('express');
const router = express.Router();
const { protect, checkBusinessOwnership } = require('../middlewares/auth');
const { AutomationRule } = require('../models');

// All routes require authentication
router.use(protect);

// Get all automation rules
router.get('/:businessId/automation-rules', checkBusinessOwnership, async (req, res) => {
  try {
    const rules = await AutomationRule.find({ business: req.params.businessId })
      .sort({ order: 1, createdAt: -1 });

    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single rule
router.get('/:businessId/automation-rules/:ruleId', checkBusinessOwnership, async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.ruleId,
      business: req.params.businessId
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create automation rule
router.post('/:businessId/automation-rules', checkBusinessOwnership, async (req, res) => {
  try {
    const rule = await AutomationRule.create({
      business: req.params.businessId,
      ...req.body
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update automation rule
router.put('/:businessId/automation-rules/:ruleId', checkBusinessOwnership, async (req, res) => {
  try {
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: req.params.ruleId, business: req.params.businessId },
      req.body,
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete automation rule
router.delete('/:businessId/automation-rules/:ruleId', checkBusinessOwnership, async (req, res) => {
  try {
    const rule = await AutomationRule.findOneAndDelete({
      _id: req.params.ruleId,
      business: req.params.businessId
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle rule active status
router.patch('/:businessId/automation-rules/:ruleId/toggle', checkBusinessOwnership, async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.ruleId,
      business: req.params.businessId
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reorder rules
router.put('/:businessId/automation-rules/reorder', checkBusinessOwnership, async (req, res) => {
  try {
    const { ruleIds } = req.body;

    const updates = ruleIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, business: req.params.businessId },
        update: { $set: { order: index } }
      }
    }));

    await AutomationRule.bulkWrite(updates);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
