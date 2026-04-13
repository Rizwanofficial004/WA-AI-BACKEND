const express = require('express');
const router = express.Router();
const { protect, checkBusinessOwnership, checkBusinessAccess } = require('../middlewares/auth');
const { ChatTag, Conversation } = require('../models');

// All routes require authentication
router.use(protect);

// Get all tags for business - both owner and agent can view
router.get('/:businessId/tags', checkBusinessAccess, async (req, res) => {
  try {
    const tags = await ChatTag.find({ business: req.params.businessId, isActive: true })
      .sort({ usageCount: -1, name: 1 });

    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create tag
router.post('/:businessId/tags', checkBusinessOwnership, async (req, res) => {
  try {
    const { name, color, description, category } = req.body;

    const existing = await ChatTag.findOne({
      business: req.params.businessId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Tag already exists' });
    }

    const tag = await ChatTag.create({
      business: req.params.businessId,
      name,
      color: color || '#3B82F6',
      description,
      category: category || 'custom',
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update tag
router.put('/:businessId/tags/:tagId', checkBusinessOwnership, async (req, res) => {
  try {
    const { name, color, description, category } = req.body;

    const tag = await ChatTag.findOneAndUpdate(
      { _id: req.params.tagId, business: req.params.businessId },
      { name, color, description, category },
      { new: true }
    );

    if (!tag) {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }

    res.json({ success: true, data: tag });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete tag
router.delete('/:businessId/tags/:tagId', checkBusinessOwnership, async (req, res) => {
  try {
    const tag = await ChatTag.findOneAndUpdate(
      { _id: req.params.tagId, business: req.params.businessId },
      { isActive: false },
      { new: true }
    );

    if (!tag) {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }

    res.json({ success: true, message: 'Tag deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add tag to conversation - both owner and agent can add tags
router.post('/:businessId/conversations/:conversationId/tags', checkBusinessAccess, async (req, res) => {
  try {
    const { tagName, tagColor } = req.body;

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: req.params.conversationId,
        business: req.params.businessId
      },
      {
        $addToSet: {
          tags: {
            name: tagName,
            color: tagColor || '#3B82F6',
            addedBy: req.user._id,
            addedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Update tag usage count
    await ChatTag.findOneAndUpdate(
      { business: req.params.businessId, name: tagName },
      { $inc: { usageCount: 1 } }
    );

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove tag from conversation - both owner and agent can remove tags
router.delete('/:businessId/conversations/:conversationId/tags/:tagName', checkBusinessAccess, async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: req.params.conversationId,
        business: req.params.businessId
      },
      {
        $pull: {
          tags: { name: req.params.tagName }
        }
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get conversations by tag - both owner and agent can view
router.get('/:businessId/tags/:tagName/conversations', checkBusinessAccess, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      business: req.params.businessId,
      'tags.name': req.params.tagName
    })
    .sort({ lastMessageAt: -1 })
    .populate('assignedAgent', 'name');

    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
