const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import routes
const {
  authRoutes,
  businessRoutes,
  conversationRoutes,
  knowledgeRoutes,
  orderRoutes,
  leadRoutes,
  webhookRoutes
} = require('./routes');

// Import middleware
const { errorHandler, rateLimiter } = require('./middlewares');

const app = express();

// Behind ngrok / reverse proxies WhatsApp (and browsers) may send X-Forwarded-For.
// Required for express-rate-limit to use client IP safely without throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

// Security middleware
app.use(helmet());

// CORS configuration - allow all in development
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use('/api/', rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI WhatsApp Assistant API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '2.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/businesses', conversationRoutes);
app.use('/api/businesses', knowledgeRoutes);
app.use('/api/businesses', orderRoutes);
app.use('/api/businesses', leadRoutes);
app.use('/api/businesses', require('./routes/productRoutes'));

// New SaaS routes
// IMPORTANT: Public invite routes FIRST (before /:businessId/*)
app.use('/api/businesses', require('./routes/inviteRoutes'));
app.use('/api/businesses', require('./routes/agentRoutes'));
app.use('/api/businesses', require('./routes/automationRoutes'));
app.use('/api/businesses', require('./routes/broadcastRoutes'));
app.use('/api/businesses', require('./routes/analyticsRoutes'));
app.use('/api/businesses', require('./routes/tagRoutes'));

// Webhook routes (WhatsApp)
app.use('/webhook', webhookRoutes);

// Test routes (no auth required for testing)
const testRoutes = require('./routes/testRoutes');
app.use('/api/test', testRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/build', 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
