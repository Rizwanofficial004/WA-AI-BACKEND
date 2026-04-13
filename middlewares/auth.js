const jwt = require('jsonwebtoken');
const { User, Agent } = require('../models');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = await User.findById(decoded.id);
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if user has access to the business (owner OR agent)
const checkBusinessAccess = async (req, res, next) => {
  try {
    const businessId = req.params.businessId || req.body.businessId;
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    const Business = require('../models').Business;
    const business = await Business.findById(businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const isOwner = business.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    // Check if user is an agent for this business
    let isAgent = false;
    if (!isOwner && !isAdmin) {
      const agent = await Agent.findOne({ 
        user: req.user._id, 
        business: businessId,
        isActive: true 
      });
      isAgent = !!agent;
      if (isAgent) {
        req.agent = agent;
      }
    }

    if (!isOwner && !isAdmin && !isAgent) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this business'
      });
    }

    req.business = business;
    req.isOwner = isOwner || isAdmin;
    req.isAgent = isAgent;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking business access'
    });
  }
};

// Owner-only routes (no agent access)
const checkBusinessOwnership = async (req, res, next) => {
  try {
    const businessId = req.params.businessId || req.body.businessId;
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID is required'
      });
    }

    const Business = require('../models').Business;
    const business = await Business.findById(businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const isOwner = business.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only business owner can access this resource'
      });
    }

    req.business = business;
    req.isOwner = true;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking business ownership'
    });
  }
};

module.exports = {
  protect,
  authorize,
  checkBusinessAccess,
  checkBusinessOwnership
};