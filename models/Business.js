const mongoose = require('mongoose');

const BUSINESS_TYPES = {
  ECOMMERCE: 'ecommerce',
  RESTAURANT: 'restaurant',
  SALON: 'salon',
  MEDICAL: 'medical',
  REAL_ESTATE: 'real_estate',
  AUTOMOTIVE: 'automotive',
  EDUCATION: 'education',
  TRAVEL: 'travel',
  OTHER: 'other'
};

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: 100
  },
  whatsappNumber: {
    type: String,
    required: [true, 'WhatsApp number is required'],
    unique: true,
    trim: true
  },
  whatsappPhoneNumberId: {
    type: String,
    trim: true
  },
  whatsappCredentials: {
    token: { type: String, trim: true },
    verifyToken: { type: String, trim: true },
    phoneNumberId: { type: String, trim: true },
    businessAccountId: { type: String, trim: true },
    webhookUrl: { type: String, trim: true }
  },
  whatsappWebConnected: {
    type: Boolean,
    default: false
  },
  whatsappWebNumber: {
    type: String,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    trim: true
  },
  businessType: {
    type: String,
    enum: Object.values(BUSINESS_TYPES),
    default: BUSINESS_TYPES.OTHER
  },
  isWhatsAppConnected: {
    type: Boolean,
    default: false
  },
  aiApiKey: {
    type: String,
    trim: true
  },
  isAIEnabled: {
    type: Boolean,
    default: true
  },
  aiPersonality: {
    type: String,
    default: 'You are a helpful customer service assistant for this business. Be polite, professional, and helpful.'
  },
  welcomeMessage: {
    type: String,
    default: 'Hello! Thank you for contacting us. How can I help you today?'
  },
  businessHours: {
    enabled: { type: Boolean, default: false },
    timezone: { type: String, default: 'UTC' },
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  quickActions: {
    type: [{
      id: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String },
      action: { type: String, enum: ['menu', 'order', 'track', 'appointment', 'quote', 'custom'], default: 'custom' },
      metadata: { type: mongoose.Schema.Types.Mixed }
    }],
    default: [
      { id: 'main_menu', title: 'Main Menu', action: 'menu' },
      { id: 'place_order', title: 'Place Order', action: 'order' },
      { id: 'track_order', title: 'Track Order', action: 'track' },
      { id: 'talk_agent', title: 'Talk to Agent', action: 'custom' }
    ]
  },
  settings: {
    autoReply: { type: Boolean, default: true },
    collectLeads: { type: Boolean, default: true },
    takeOrders: { type: Boolean, default: false },
    enableProductSearch: { type: Boolean, default: false },
    enableOrderFlow: { type: Boolean, default: false },
    enableAppointmentBooking: { type: Boolean, default: false },
    enableQuoteRequests: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Business', businessSchema);
module.exports.BUSINESS_TYPES = BUSINESS_TYPES;