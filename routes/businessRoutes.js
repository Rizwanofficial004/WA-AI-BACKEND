const express = require('express');
const router = express.Router();
const { businessController } = require('../controllers');
const { protect, createBusinessValidation, updateBusinessValidation, checkBusinessOwnership, validate } = require('../middlewares');
const { body } = require('express-validator');

const whatsappConnectValidation = [
  body('whatsappNumber').optional().trim(),
  body('token').optional().trim(),
  body('verifyToken').optional().trim(),
  body('phoneNumberId').optional().trim(),
  body('businessAccountId').optional().trim(),
  body('webhookUrl').optional().trim(),
  validate
];

// Business CRUD
router.post('/', protect, createBusinessValidation, businessController.createBusiness);
router.get('/', protect, businessController.getBusinesses);
router.get('/:businessId', protect, businessController.getBusiness);
router.put('/:businessId', protect, updateBusinessValidation, businessController.updateBusiness);
router.delete('/:businessId', protect, businessController.deleteBusiness);

// WhatsApp integration
router.post('/:businessId/whatsapp/connect', protect, checkBusinessOwnership, whatsappConnectValidation, businessController.connectWhatsApp);
router.post('/:businessId/whatsapp/test', protect, checkBusinessOwnership, businessController.testWhatsAppConnection);

// AI settings
router.put('/:businessId/ai/toggle', protect, businessController.toggleAI);
router.put('/:businessId/settings', protect, businessController.updateSettings);

// Business stats
router.get('/:businessId/stats', protect, businessController.getBusinessStats);

module.exports = router;