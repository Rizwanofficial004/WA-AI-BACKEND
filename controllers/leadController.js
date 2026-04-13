const { LeadRepository } = require('../repositories');

// @desc    Get all leads for a business
// @route   GET /api/businesses/:businessId/leads
// @access  Private
const getLeads = async (req, res, next) => {
  try {
    const leadRepository = new LeadRepository();
    const { status, page = 1, limit = 20 } = req.query;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    let leads;
    if (status) {
      leads = await leadRepository.findByStatus(req.params.businessId, status);
    } else {
      leads = await leadRepository.findByBusiness(req.params.businessId, options);
    }
    
    res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single lead
// @route   GET /api/businesses/:businessId/leads/:leadId
// @access  Private
const getLead = async (req, res, next) => {
  try {
    const leadRepository = new LeadRepository();
    const lead = await leadRepository.findById(req.params.leadId);
    
    if (!lead || lead.business.toString() !== req.params.businessId) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lead status
// @route   PUT /api/businesses/:businessId/leads/:leadId/status
// @access  Private
const updateLeadStatus = async (req, res, next) => {
  try {
    const leadRepository = new LeadRepository();
    const lead = await leadRepository.findById(req.params.leadId);
    
    if (!lead || lead.business.toString() !== req.params.businessId) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    const updatedLead = await leadRepository.updateById(req.params.leadId, {
      status: req.body.status
    });
    
    res.status(200).json({
      success: true,
      data: updatedLead
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add note to lead
// @route   POST /api/businesses/:businessId/leads/:leadId/notes
// @access  Private
const addLeadNote = async (req, res, next) => {
  try {
    const leadRepository = new LeadRepository();
    const lead = await leadRepository.findById(req.params.leadId);
    
    if (!lead || lead.business.toString() !== req.params.businessId) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    const updatedLead = await leadRepository.updateById(req.params.leadId, {
      $push: { notes: { content: req.body.content } }
    });
    
    res.status(200).json({
      success: true,
      data: updatedLead
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete lead
// @route   DELETE /api/businesses/:businessId/leads/:leadId
// @access  Private
const deleteLead = async (req, res, next) => {
  try {
    const leadRepository = new LeadRepository();
    const lead = await leadRepository.findById(req.params.leadId);
    
    if (!lead || lead.business.toString() !== req.params.businessId) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    await leadRepository.deleteById(req.params.leadId);
    
    res.status(200).json({
      success: true,
      data: { message: 'Lead deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeads,
  getLead,
  updateLeadStatus,
  addLeadNote,
  deleteLead
};