const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['agent', 'supervisor'],
    default: 'agent'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

inviteSchema.index({ token: 1 });
inviteSchema.index({ email: 1, business: 1 });

inviteSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

inviteSchema.methods.isValid = function() {
  return this.status === 'pending' && !this.isExpired();
};

module.exports = mongoose.model('Invite', inviteSchema);
