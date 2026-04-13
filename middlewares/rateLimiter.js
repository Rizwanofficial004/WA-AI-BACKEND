const rateLimit = require('express-rate-limit');

// In development, skip limits so local work is not blocked (set RATE_LIMIT_FORCE=true to test limits locally).
function skipRateLimitInDevelopment() {
  if (process.env.RATE_LIMIT_FORCE === 'true') return false;
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'dev';
}

// General rate limiter
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimitInDevelopment
});

// Strict rate limiter for auth routes
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimitInDevelopment
});

// Webhook rate limiter (more lenient for WhatsApp webhooks)
const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 requests per minute
  message: {
    success: false,
    message: 'Too many webhook requests.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimitInDevelopment
});

// API rate limiter
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: {
    success: false,
    message: 'Too many API requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimitInDevelopment
});

module.exports = {
  rateLimiter,
  authRateLimiter,
  webhookRateLimiter,
  apiRateLimiter
};