const express = require('express');
const router = express.Router();
const { leadController } = require('../controllers');
const { protect, checkBusinessAccess } = require('../middlewares');

// Lead routes (nested under business)
// Both owner and agent can access leads
router.get('/:businessId/leads', protect, checkBusinessAccess, leadController.getLeads);
router.get('/:businessId/leads/:leadId', protect, checkBusinessAccess, leadController.getLead);
router.put('/:businessId/leads/:leadId/status', protect, checkBusinessAccess, leadController.updateLeadStatus);
router.post('/:businessId/leads/:leadId/notes', protect, checkBusinessAccess, leadController.addLeadNote);
router.delete('/:businessId/leads/:leadId', protect, checkBusinessAccess, leadController.deleteLead);

module.exports = router;