const inviteService = require('../services/inviteService');
const { whatsappService } = require('../services');
const { Invite, Business } = require('../models');

const createInvite = async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { email, role } = req.body;

    const result = await inviteService.createInvite({
      email,
      businessId,
      invitedByUserId: req.user._id,
      role
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getInvites = async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const invites = await inviteService.getInvitesByBusiness(businessId);

    res.status(200).json({
      success: true,
      data: invites
    });
  } catch (error) {
    next(error);
  }
};

const validateInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const invite = await inviteService.validateInvite(token);

    res.status(200).json({
      success: true,
      data: {
        email: invite.email,
        businessName: invite.business?.name,
        invitedBy: invite.invitedBy ? `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}` : 'Unknown',
        role: invite.role,
        expiresAt: invite.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const cancelInvite = async (req, res, next) => {
  try {
    const { businessId, inviteId } = req.params;
    await inviteService.cancelInvite(inviteId, businessId);

    res.status(200).json({
      success: true,
      message: 'Invite cancelled'
    });
  } catch (error) {
    next(error);
  }
};

const resendInvite = async (req, res, next) => {
  try {
    const { businessId, inviteId } = req.params;
    const result = await inviteService.resendInvite(inviteId, businessId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { firstName, lastName, password } = req.body;
    
    const result = await inviteService.acceptInvite(token, {
      firstName,
      lastName,
      password
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now login.',
      data: {
        user: {
          id: result.user._id,
          email: result.user.email,
          role: result.user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const sendInviteViaWhatsApp = async (req, res, next) => {
  try {
    const { businessId, inviteId } = req.params;
    const { phoneNumber } = req.body;

    const invite = await Invite.findOne({ _id: inviteId, business: businessId });
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found'
      });
    }

    if (invite.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Invite already accepted'
      });
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    if (!business.isWhatsAppConnected) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not connected for this business'
      });
    }

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${invite.token}`;
    
    const message = `You've been invited to join our team! 🎉

Click the link below to register:
${inviteLink}

Role: ${invite.role}
Expires: ${invite.expiresAt.toLocaleDateString()}

Best regards,
Team`;

    const waResult = await whatsappService.sendMessage(business, phoneNumber, message);
    if (!waResult) {
      return res.status(502).json({
        success: false,
        message:
          'WhatsApp did not accept the message. Please check your WhatsApp credentials in business settings and try again.'
      });
    }

    invite.sentViaWhatsApp = true;
    invite.whatsappSentAt = new Date();
    await invite.save();

    res.json({
      success: true,
      message: 'Invite sent via WhatsApp'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createInvite,
  getInvites,
  validateInvite,
  cancelInvite,
  resendInvite,
  acceptInvite,
  sendInviteViaWhatsApp
};
