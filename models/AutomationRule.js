const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Trigger conditions
  trigger: {
    type: {
      type: String,
      enum: ['keyword', 'message_contains', 'message_exact', 'regex', 'first_message', 'time_based', 'no_response'],
      required: true
    },
    keywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    regexPattern: {
      type: String
    },
    timeCondition: {
      daysOfWeek: [Number], // 0-6, Sunday-Saturday
      startTime: String, // HH:mm format
      endTime: String
    },
    noResponseMinutes: {
      type: Number
    }
  },
  // Actions to perform
  actions: [{
    type: {
      type: String,
      enum: [
        'send_message',
        'send_template',
        'assign_agent',
        'set_priority',
        'add_tag',
        'remove_tag',
        'change_status',
        'handoff_to_agent',
        'update_state',
        'create_lead',
        'webhook'
      ],
      required: true
    },
    // For send_message action
    message: {
      type: String
    },
    // For send_template action
    templateName: {
      type: String
    },
    templateLanguage: {
      type: String,
      default: 'en'
    },
    // For assign_agent action
    assignTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent'
    },
    assignMethod: {
      type: String,
      enum: ['round_robin', 'least_loaded', 'specific'],
      default: 'round_robin'
    },
    // For set_priority action
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent']
    },
    // For add_tag/remove_tag action
    tagName: {
      type: String
    },
    tagColor: {
      type: String,
      default: '#3B82F6'
    },
    // For change_status action
    status: {
      type: String,
      enum: ['active', 'resolved', 'pending', 'archived']
    },
    // For update_state action
    newState: {
      type: String
    },
    stateData: {
      type: mongoose.Schema.Types.Mixed
    },
    // For webhook action
    webhookUrl: {
      type: String
    },
    webhookMethod: {
      type: String,
      enum: ['GET', 'POST', 'PUT'],
      default: 'POST'
    },
    webhookHeaders: {
      type: mongoose.Schema.Types.Mixed
    },
    webhookBody: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  // Execution order
  order: {
    type: Number,
    default: 0
  },
  // Execution limits
  maxExecutions: {
    type: Number,
    default: 0 // 0 = unlimited
  },
  executionCount: {
    type: Number,
    default: 0
  },
  // Cooldown to prevent duplicate triggers
  cooldownMinutes: {
    type: Number,
    default: 0
  },
  lastExecutedAt: {
    type: Date
  },
  // Stats
  stats: {
    totalTriggers: { type: Number, default: 0 },
    lastTriggeredAt: Date
  }
}, {
  timestamps: true
});

// Indexes
automationRuleSchema.index({ business: 1, isActive: 1, order: 1 });
automationRuleSchema.index({ business: 1, 'trigger.type': 1 });

module.exports = mongoose.model('AutomationRule', automationRuleSchema);
