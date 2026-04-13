const { protect, authorize, checkBusinessAccess, checkBusinessOwnership } = require('./auth');
const errorHandler = require('./errorHandler');
const { rateLimiter, authRateLimiter, webhookRateLimiter, apiRateLimiter } = require('./rateLimiter');
const {
  validate,
  registerValidation,
  loginValidation,
  createBusinessValidation,
  updateBusinessValidation,
  addKnowledgeValidation,
  createOrderValidation,
  updateConversationValidation,
  validateId,
  validateBusinessId
} = require('./validation');

module.exports = {
  protect,
  authorize,
  checkBusinessAccess,
  checkBusinessOwnership,
  errorHandler,
  rateLimiter,
  authRateLimiter,
  webhookRateLimiter,
  apiRateLimiter,
  validate,
  registerValidation,
  loginValidation,
  createBusinessValidation,
  updateBusinessValidation,
  addKnowledgeValidation,
  createOrderValidation,
  updateConversationValidation,
  validateId,
  validateBusinessId
};