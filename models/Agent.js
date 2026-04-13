const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['agent', 'supervisor', 'admin'],
    default: 'agent'
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away'],
    default: 'offline'
  },
  avatar: {
    type: String
  },
  maxConcurrentChats: {
    type: Number,
    default: 5
  },
  currentChatCount: {
    type: Number,
    default: 0
  },
  permissions: {
    canAssignChats: { type: Boolean, default: false },
    canCloseChats: { type: Boolean, default: true },
    canTagChats: { type: Boolean, default: true },
    canViewAnalytics: { type: Boolean, default: false },
    canManageBroadcasts: { type: Boolean, default: false },
    canManageAgents: { type: Boolean, default: false }
  },
  stats: {
    totalChatsHandled: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    totalMessagesSent: { type: Number, default: 0 },
    satisfactionRating: { type: Number, default: 0 }
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
agentSchema.index({ business: 1, status: 1 });
agentSchema.index({ business: 1, user: 1 });
agentSchema.index({ business: 1, email: 1 });

module.exports = mongoose.model('Agent', agentSchema);
