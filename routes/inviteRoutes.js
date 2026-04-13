const express = require('express');
const router = express.Router();
const { inviteController } = require('../controllers');
const { protect, checkBusinessOwnership } = require('../middlewares');

// PUBLIC routes FIRST (order matters!)
router.get('/validate/:token', inviteController.validateInvite);
router.post('/invite/:token/accept', inviteController.acceptInvite);

// Protected routes AFTER public routes
router.post('/:businessId/invites', protect, checkBusinessOwnership, inviteController.createInvite);
router.get('/:businessId/invites', protect, checkBusinessOwnership, inviteController.getInvites);
router.delete('/:businessId/invites/:inviteId', protect, checkBusinessOwnership, inviteController.cancelInvite);
router.post('/:businessId/invites/:inviteId/resend', protect, checkBusinessOwnership, inviteController.resendInvite);
router.post('/:businessId/invites/:inviteId/send-whatsapp', protect, checkBusinessOwnership, inviteController.sendInviteViaWhatsApp);

module.exports = router;
