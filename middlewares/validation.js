const { body, param, validationResult } = require('express-validator');
const { Business } = require('../models');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_subaddress: false }),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  validate
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_subaddress: false }),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

// Business validation rules
const createBusinessValidation = [
  body('name')
    .notEmpty()
    .withMessage('Business name is required')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Business name must be less than 100 characters'),
  body('whatsappNumber')
    .notEmpty()
    .withMessage('WhatsApp number is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number in E.164 format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('category')
    .optional()
    .trim(),
  validate
];

const updateBusinessValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Business name must be less than 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('aiPersonality')
    .optional()
    .trim(),
  body('welcomeMessage')
    .optional()
    .trim(),
  validate
];

// Knowledge base validation rules
const addKnowledgeValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('content')
    .notEmpty()
    .withMessage('Content is required'),
  body('category')
    .optional()
    .isIn(['faq', 'product', 'policy', 'general', 'custom'])
    .withMessage('Invalid category'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  validate
];

// Order validation rules
const createOrderValidation = [
  body('customerPhone')
    .notEmpty()
    .withMessage('Customer phone is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number in E.164 format'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.productName')
    .notEmpty()
    .withMessage('Product name is required'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('items.*.price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  validate
];

// Conversation validation rules
const updateConversationValidation = [
  body('status')
    .optional()
    .isIn(['active', 'resolved', 'pending'])
    .withMessage('Invalid status'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('notes')
    .optional()
    .trim(),
  validate
];

// ID parameter validation
const validateId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  validate
];

const validateBusinessId = [
  param('businessId')
    .isMongoId()
    .withMessage('Invalid business ID format'),
  validate
];

module.exports = {
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