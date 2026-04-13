const crypto = require('crypto');
const { Invite, User, Agent } = require('../models');

class InviteService {
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async createInvite({ email, businessId, invitedByUserId, role = 'agent', expiresInDays = 7 }) {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    // Check if user already exists
    if (existingUser) {
      // Check if already an ACTIVE agent for this business
      const existingAgent = await Agent.findOne({ 
        user: existingUser._id, 
        business: businessId,
        isActive: true 
      });
      
      if (existingAgent) {
        throw new Error('User is already an active team member of this business');
      }
      
      // Check if there's an inactive agent record - reactivate it
      const inactiveAgent = await Agent.findOne({ 
        user: existingUser._id, 
        business: businessId,
        isActive: false 
      });
      
      if (inactiveAgent) {
        // Reactivate the existing agent record
        inactiveAgent.isActive = true;
        inactiveAgent.role = role;
        await inactiveAgent.save();
        
        return {
          agent: inactiveAgent,
          reactivated: true,
          message: 'User re-added as team member (they can login with existing credentials)'
        };
      }
      
      // User exists but no agent record - add them directly as agent
      const agent = await Agent.create({
        user: existingUser._id,
        business: businessId,
        name: `${existingUser.firstName || ''} ${existingUser.lastName || ''}`.trim() || existingUser.email,
        email: existingUser.email,
        role: role,
        isActive: true
      });
      
      return {
        agent,
        addedDirectly: true,
        message: 'User added as team member directly (they can login with existing credentials)'
      };
    }

    const existingInvite = await Invite.findOne({ 
      email: email.toLowerCase(), 
      business: businessId,
      status: 'pending'
    });
    if (existingInvite && !existingInvite.isExpired()) {
      throw new Error('An invite is already pending for this email');
    }

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const invite = await Invite.create({
      email: email.toLowerCase(),
      business: businessId,
      invitedBy: invitedByUserId,
      token,
      role,
      expiresAt
    });

    return {
      invite,
      inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${token}`
    };
  }

  async validateInvite(token) {
    const invite = await Invite.findOne({ token })
      .populate('business', 'name')
      .populate('invitedBy', 'firstName lastName email');

    if (!invite) {
      throw new Error('Invalid invite link');
    }

    if (invite.status === 'accepted') {
      throw new Error('This invite has already been used');
    }

    if (invite.isExpired()) {
      invite.status = 'expired';
      await invite.save();
      throw new Error('This invite has expired');
    }

    return invite;
  }

  async acceptInvite(token, userData) {
    const invite = await this.validateInvite(token);

    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = await User.create({
      email: invite.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: 'agent'
    });

    let agent = await Agent.findOne({ user: user._id, business: invite.business });
    if (!agent) {
      agent = await Agent.create({
        user: user._id,
        business: invite.business,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        role: invite.role
      });
    }

    invite.status = 'accepted';
    await invite.save();

    return { user, agent, business: invite.business };
  }

  async getInvitesByBusiness(businessId) {
    const invites = await Invite.find({ business: businessId })
      .populate('invitedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    return invites;
  }

  async getInviteByToken(token) {
    return await Invite.findOne({ token });
  }

  async cancelInvite(inviteId, businessId) {
    const invite = await Invite.findOne({ _id: inviteId, business: businessId });
    if (!invite) {
      throw new Error('Invite not found');
    }
    if (invite.status === 'accepted') {
      throw new Error('Cannot cancel accepted invite');
    }
    invite.status = 'expired';
    await invite.save();
    return invite;
  }

  async resendInvite(inviteId, businessId) {
    const invite = await Invite.findOne({ _id: inviteId, business: businessId });
    if (!invite) {
      throw new Error('Invite not found');
    }
    if (invite.status === 'accepted') {
      throw new Error('Cannot resend accepted invite');
    }

    const newToken = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    invite.token = newToken;
    invite.expiresAt = expiresAt;
    invite.status = 'pending';
    await invite.save();

    return {
      invite,
      inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${newToken}`
    };
  }
}

module.exports = new InviteService();
