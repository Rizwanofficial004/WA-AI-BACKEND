const axios = require('axios');
const { BusinessRepository, ConversationRepository, MessageRepository, LeadRepository, OrderRepository } = require('../repositories');
const aiService = require('./aiService');
const conversationService = require('./conversationService');
const orderFlowService = require('./orderFlowService');
const formService = require('./formService');
const interactiveService = require('./interactiveMessageService');
const orderTrackingService = require('./orderTrackingService');
const { ORDER_STATES } = orderFlowService;

function isWhatsAppTokenError(error) {
  const fb = error?.response?.data?.error;
  return fb?.code === 190;
}

function logWhatsAppGraphError(context, error) {
  if (isWhatsAppTokenError(error)) {
    console.error(
      `[WhatsApp Graph] ${context}: access token invalid or expired (OAuth 190). ` +
        'Please update WhatsApp credentials in business settings.'
    );
    return;
  }
  console.error(`[WhatsApp Graph] ${context}:`, error.response?.data || error.message);
}

class WhatsAppService {
  constructor() {
    this.businessRepository = new BusinessRepository();
    this.conversationRepository = new ConversationRepository();
    this.messageRepository = new MessageRepository();
    this.leadRepository = new LeadRepository();
    this.orderRepository = new OrderRepository();
    this.apiVersion = 'v17.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    // Create dedicated axios instance for WhatsApp to avoid header conflicts
    this.axiosInstance = axios.create();
  }

  async verifyWebhook(mode, token, challenge) {
    console.log('Webhook verification attempt:');
    console.log('  mode:', mode);
    console.log('  received token:', token);
    
    if (mode === 'subscribe') {
      const business = await this.businessRepository.findOne({
        'whatsappCredentials.verifyToken': token
      });

      if (business) {
        console.log(`Webhook verified successfully for business: ${business.name}`);
        return challenge;
      }

      console.log('Webhook verification FAILED - no business found with matching verifyToken');
      return null;
    }
    
    return null;
  }

  async processWebhook(body) {
    try {
      console.log('========== WEBHOOK RECEIVED ==========');
      console.log('Body:', JSON.stringify(body, null, 2));
      
      const { entry } = body;
      
      if (!entry || !entry.length) {
        console.log('No entry found in webhook');
        return;
      }

      for (const e of entry) {
        const { changes } = e;
        
        if (!changes || !changes.length) {
          continue;
        }

        for (const change of changes) {
          if (change.field !== 'messages') {
            continue;
          }

          const { value } = change;
          
          if (!value.messages || !value.messages.length) {
            continue;
          }

          for (const message of value.messages) {
            await this.handleIncomingMessage(message, value.contacts, value.metadata);
          }
        }
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }

  async handleIncomingMessage(message, contacts, metadata) {
    const customerPhone = message.from;
    const customerName = contacts?.[0]?.profile?.name || null;
    
    // Extract message content based on type
    let messageContent = '';
    let messageType = 'text';
    let imageUrl = null;

    if (message.type === 'text') {
      messageContent = message.text.body;
    } else if (message.type === 'image') {
      messageType = 'image';
      // Get image URL from WhatsApp API - will be done after finding business
      const imageId = message.image?.id;
      console.log('Image message received, image ID:', imageId);
      console.log('Full image message:', JSON.stringify(message.image, null, 2));
      
      // Store imageId for later, we'll fetch URL after finding business
      if (imageId) {
        messageContent = message.image?.caption || 'I need this product, show me similar items';
      } else {
        console.log('No image ID found in message');
      }
      messageContent = message.image?.caption || 'I need this product, show me similar items';
    } else if (message.type === 'document') {
      messageContent = '[Document received]';
      messageType = 'document';
    } else if (message.type === 'audio') {
      messageContent = '[Audio received]';
      messageType = 'audio';
    } else if (message.type === 'video') {
      messageContent = '[Video received]';
      messageType = 'video';
    } else {
      messageContent = `[${message.type} received]`;
      messageType = message.type;
    }

    // Find the business by phone number ID (recipient of the message)
    const business = await this.findBusinessByPhoneNumberId(metadata?.phone_number_id);
    
    console.log('Phone Number ID:', metadata?.phone_number_id);
    
    if (!business) {
      console.log('No business found for phone number ID:', metadata?.phone_number_id);
      return;
    }
    
    console.log('Business found:', business.name, '| AI Enabled:', business.isAIEnabled);

    if (!business.isAIEnabled) {
      console.log('AI is disabled for business:', business._id);
      return;
    }

    // If message was an image, fetch the image URL now that we have the business
    if (messageType === 'image' && message.image?.id) {
      try {
        imageUrl = await this.getImageUrl(message.image.id, business);
        console.log('Image URL obtained:', imageUrl);
      } catch (err) {
        console.error('Failed to get image URL:', err.message);
      }
    }

    // Get or create conversation
    const conversation = await conversationService.getOrCreateConversation(
      business._id,
      customerPhone,
      customerName
    );

    // Store the customer message
    await this.messageRepository.create({
      conversation: conversation._id,
      business: business._id,
      sender: 'customer',
      content: messageContent,
      messageType,
      metadata: {
        waMessageId: message.id,
        timestamp: new Date(message.timestamp * 1000)
      }
    });

    // Get conversation history for context (oldest to newest for AI)
    const recentMessages = await this.messageRepository.findByConversation(
      conversation._id,
      { limit: 20 }
    );
    
    // Debug: Log conversation history
    console.log(`[History] Found ${recentMessages.length} messages for conversation ${conversation._id}`);
    if (recentMessages.length > 0) {
      console.log('[History] Oldest:', recentMessages[0].content?.substring(0, 30), '| Sender:', recentMessages[0].sender);
      console.log('[History] Newest:', recentMessages[recentMessages.length - 1].content?.substring(0, 30), '| Sender:', recentMessages[recentMessages.length - 1].sender);
    }

    // Handle interactive message replies (buttons/list)
    if (message.type === 'interactive') {
      const buttonReply = interactiveService.parseButtonReply(message.interactive);
      const listReply = interactiveService.parseListReply(message.interactive);
      
      if (buttonReply) {
        console.log('Button reply received:', buttonReply);
        const handled = await this.handleButtonReply(business, customerPhone, buttonReply, conversation);
        if (handled) return;
      }
      
      if (listReply) {
        console.log('List reply received:', listReply);
        const handled = await this.handleListReply(business, customerPhone, listReply, conversation);
        if (handled) return;
      }
    }

    // Check for order tracking request
    if (messageType === 'text' && orderTrackingService.isTrackingRequest(messageContent)) {
      console.log('Order tracking request detected');
      const trackingHandled = await this.handleTrackingRequest(business, customerPhone, messageContent);
      if (trackingHandled) return;
    }

    // Check if customer is in order flow
    if (orderFlowService.isInOrderFlow(business._id, customerPhone)) {
      console.log('Customer is in order flow, processing input...');
      const flowResponse = await this.processOrderFlow(business, customerPhone, messageContent, conversation);
      if (flowResponse) {
        // Order flow handled the message, don't continue with normal processing
        return;
      }
    }

    // Check for greeting/menu commands
    if (messageType === 'text' && this.isGreetingOrMenu(messageContent)) {
      console.log('Customer sent greeting/menu request');
      // Use business's custom quick actions, fallback to default
      const menuMsg = business.quickActions?.length > 0
        ? interactiveService.createCustomQuickActionsMenu(business.quickActions, business.name)
        : interactiveService.createQuickActionsMenu();
      await this.sendInteractiveMessage(business, customerPhone, menuMsg);
      return;
    }

    // Check if customer wants to start ordering (only if enabled in settings)
    const orderEnabled = business.settings?.takeOrders || business.settings?.enableOrderFlow;
    if (messageType === 'text' && orderEnabled && this.isOrderRequest(messageContent)) {
      console.log('Customer wants to place an order');
      const orderResponse = await this.startOrderFlow(business, customerPhone, messageContent, conversation);
      if (orderResponse) {
        return;
      }
    }

    // Check if customer is searching for products (only if product search is enabled)
    let productSearchResults = [];
    let isProductSearch = false;
    const productSearchEnabled = business.settings?.enableProductSearch;

    // If image was sent, analyze it for product search (only if enabled)
    if (productSearchEnabled && messageType === 'image' && imageUrl) {
      console.log('Analyzing customer image for product search...');
      const imageAnalysis = await aiService.analyzeImage(imageUrl, business._id);
      console.log('Image analysis:', JSON.stringify(imageAnalysis, null, 2));
      
      if (imageAnalysis.keywords?.length > 0) {
        const searchQuery = imageAnalysis.keywords.join(' ');
        productSearchResults = await this.searchProducts(business._id, searchQuery);
        isProductSearch = productSearchResults.length > 0;
      }
    } 
    // If text message, check if it's a product search (only if enabled)
    else if (productSearchEnabled && messageType === 'text') {
      const productCriteria = await aiService.extractProductCriteria(messageContent, business._id);
      console.log('Product criteria:', JSON.stringify(productCriteria, null, 2));
      
      // Check if AI detected this as a product search OR if there are search criteria
      if (productCriteria.isProductSearch || productCriteria.brand || productCriteria.category || productCriteria.color || productCriteria.keywords?.length > 0) {
        productSearchResults = await this.searchProductsByCriteria(business._id, productCriteria);
        isProductSearch = productSearchResults.length > 0;
        console.log('Product search triggered, found:', productSearchResults.length, 'products');
      }
    }

    // Check if this was a product search request
    let wasProductRequest = false;
    let productCriteria = null;
    
    if (messageType === 'text') {
      productCriteria = await aiService.extractProductCriteria(messageContent, business._id);
      wasProductRequest = productSearchEnabled && productCriteria.isProductSearch;
    } else if (productSearchEnabled && messageType === 'image' && imageUrl) {
      wasProductRequest = true;
    }

    // If products found, send product recommendations with images
    if (isProductSearch && productSearchResults.length > 0) {
      console.log('Found', productSearchResults.length, 'products');
      
      // Generate recommendation message
      const recommendation = await aiService.generateProductRecommendation(
        productSearchResults, 
        messageContent,
        business._id
      );
      
      // Send recommendation text
      await this.sendMessage(business, customerPhone, recommendation);
      
      // Send product images
      for (const product of productSearchResults.slice(0, 3)) {
        if (product.images?.length > 0) {
          const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
          if (primaryImage?.url) {
            await this.sendImageMessage(business, customerPhone, primaryImage.url, 
              `${product.name} - PKR ${product.price}`);
          }
        }
      }
      
      console.log('Product recommendations sent to:', customerPhone);
      
      // Create lead
      if (business.settings.collectLeads) {
        await this.createLeadIfNotExists(
          business._id,
          conversation._id,
          customerPhone,
          customerName,
          `Interested in: ${productSearchResults.map(p => p.name).join(', ')}`,
          { interest: productSearchResults.map(p => p.name).join(', '), intent: 'buying', qualified: true }
        );
      }
    } 
    // Product search but no products found - tell customer
    else if (wasProductRequest) {
      console.log('Product requested but none found in catalog');
      
      const noProductsMessage = `Humare paas abhi is category mein products available nahi hain. 😔\n\n` +
        `Aap humein bata sakte hain kya dhoond rahe hain aur hum aapki madad karenge!\n\n` +
        `Ya aap humari website pe visit kar sakte hain for more options.`;
      
      await this.sendMessage(business, customerPhone, noProductsMessage);
      
      // Still create a lead for potential interest
      if (business.settings.collectLeads) {
        await this.createLeadIfNotExists(
          business._id,
          conversation._id,
          customerPhone,
          customerName,
          `Interested in: ${productCriteria?.category || messageContent}`,
          { interest: messageContent, intent: 'inquiry', qualified: false }
        );
      }
    } else {
      // Regular AI response for non-product queries
      console.log('Generating AI response for:', messageContent);
      const aiResponse = await aiService.generateResponse(
        business._id,
        messageContent,
        recentMessages
      );
      
      console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

      if (aiResponse.success) {
        // Store AI response
        await this.messageRepository.create({
          conversation: conversation._id,
          business: business._id,
          sender: 'ai',
          content: aiResponse.response,
          messageType: 'text',
          isAIgenerated: true,
          metadata: {
            timestamp: new Date()
          }
        });

        // Check if AI response indicates handoff request
        const needsHandoff = this.detectHandoffRequest(aiResponse.response);
        
        if (needsHandoff) {
          console.log('Handoff detected in AI response - requesting human agent');
          // Send the AI response first
          await this.sendMessage(business, customerPhone, aiResponse.response);
          
          // Then request handoff
          const handoffService = require('./handoffService');
          await handoffService.requestHandoff({
            businessId: business._id,
            conversationId: conversation._id,
            customerPhone,
            reason: 'ai_detected_transfer',
            customerMessage
          });
          
          // Send handoff notification
          const handoffMsg = 'Aapko human agent se connect kiya ja raha hai.片刻 please wait karein. 🙏';
          await this.sendMessage(business, customerPhone, handoffMsg);
        } else {
          // Send response back to WhatsApp
          await this.sendMessage(business, customerPhone, aiResponse.response);
        }
        console.log('AI response sent to:', customerPhone);
      } else {
        // AI failed - send fallback message
        console.log('AI response failed, sending fallback message');
        const fallbackMsg = aiResponse.response || 'Maaf kijiye, abhi technical problem ho raha hai. Kripya baad mein try karein ya agent se baat karein.';
        const sent = await this.sendMessage(business, customerPhone, fallbackMsg);
        if (!sent) {
          console.log('FALLBACK MESSAGE ALSO FAILED to send');
        } else {
          console.log('Fallback message sent successfully to:', customerPhone);
        }
      }
    }

    // Categorize message for lead/order detection
    const category = await aiService.categorizeMessage(messageContent, business._id);
    console.log('Message category:', category);
    
    // Auto-create lead if customer shows interest
    if ((category === 'lead' || category === 'order') && business.settings.collectLeads) {
      const leadInfo = await aiService.extractLeadInfo(messageContent, recentMessages, business._id);
      await this.createLeadIfNotExists(
        business._id, 
        conversation._id, 
        customerPhone, 
        customerName, 
        messageContent,
        leadInfo
      );
    }
    
    // Auto-create order if customer wants to buy
    if (category === 'order' && business.settings.takeOrders) {
      const orderDetails = await aiService.extractOrderDetails(messageContent, business._id);
      if (orderDetails.product) {
        await this.createOrderIfNotExists(
          business._id,
          conversation._id,
          customerPhone,
          customerName,
          orderDetails
        );
      }
    }
  }

  async findBusinessByPhoneNumberId(phoneNumberId) {
    if (!phoneNumberId) return null;
    return await this.businessRepository.findOne({ whatsappPhoneNumberId: phoneNumberId });
  }

  // Get WhatsApp credentials for a business
  getCredentials(business) {
    if (!business) {
      throw new Error('Business is required for WhatsApp credentials');
    }
    
    const businessCreds = business?.whatsappCredentials || {};
    const phoneNumberId = businessCreds.phoneNumberId || business?.whatsappPhoneNumberId;
    
    if (!businessCreds.token || !phoneNumberId) {
      throw new Error('WhatsApp credentials not configured for this business');
    }
    
    return {
      token: businessCreds.token,
      phoneNumberId: phoneNumberId,
      verifyToken: businessCreds.verifyToken
    };
  }

  async sendMessage(business, recipientPhone, message) {
    try {
      const creds = this.getCredentials(business);
      const url = `${this.baseUrl}/${creds.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      };

      const response = await this.axiosInstance.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Message sent successfully');
      return response.data;
    } catch (error) {
      logWhatsAppGraphError('sendMessage', error);
      return null;
    }
  }

  // Send interactive message (buttons or list)
  async sendInteractiveMessage(business, recipientPhone, interactiveMessage) {
    try {
      const creds = this.getCredentials(business);
      const url = `${this.baseUrl}/${creds.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        ...interactiveMessage
      };

      const response = await this.axiosInstance.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Interactive message sent successfully');
      return response.data;
    } catch (error) {
      logWhatsAppGraphError('sendInteractiveMessage', error);
      return null;
    }
  }

  async sendTemplateMessage(business, recipientPhone, templateName, languageCode = 'en') {
    try {
      const creds = this.getCredentials(business);
      const url = `${this.baseUrl}/${creds.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error sending template message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendWelcomeMessage(business, customerPhone) {
    if (business.welcomeMessage) {
      await this.sendMessage(business, customerPhone, business.welcomeMessage);
    }
  }

  async createLeadIfNotExists(businessId, conversationId, customerPhone, customerName, messageContent, leadInfo = null) {
    try {
      const existingLead = await this.leadRepository.findByCustomer(businessId, customerPhone);
      
      const leadData = {
        business: businessId,
        conversation: conversationId,
        customerPhone,
        customerName,
        source: 'whatsapp',
        interest: leadInfo?.interest || messageContent.substring(0, 200),
        status: leadInfo?.qualified ? 'qualified' : 'new'
      };

      if (!existingLead) {
        const lead = await this.leadRepository.create(leadData);
        console.log('New lead created:', customerPhone, '- Interest:', leadData.interest);
      } else {
        // Update existing lead with new interest info
        await this.leadRepository.updateById(existingLead._id, {
          $set: { interest: leadData.interest },
          $push: { notes: { content: `New message: ${messageContent.substring(0, 100)}` } }
        });
        console.log('Lead updated:', customerPhone);
      }
    } catch (error) {
      console.error('Error creating/updating lead:', error);
    }
  }

  async createOrderIfNotExists(businessId, conversationId, customerPhone, customerName, orderDetails) {
    try {
      // Check if there's a recent pending order from this customer (within last hour)
      const recentOrder = await this.orderRepository.findOne({
        business: businessId,
        customerPhone: customerPhone,
        status: 'pending',
        createdAt: { $gte: new Date(Date.now() - 3600000) } // Last 1 hour
      });

      if (!recentOrder) {
        const order = await this.orderRepository.create({
          business: businessId,
          conversation: conversationId,
          customerPhone,
          customerName,
          items: [{
            productName: orderDetails.product,
            quantity: orderDetails.quantity || 1,
            price: 0, // Price will be updated by business owner
            notes: orderDetails.notes || ''
          }],
          totalAmount: 0, // Will be calculated by business owner
          status: 'pending',
          notes: 'Auto-created from WhatsApp conversation'
        });
        console.log('New order created:', customerPhone, '- Product:', orderDetails.product);
      } else {
        // Add item to existing order
        await this.orderRepository.updateById(recentOrder._id, {
          $push: {
            items: {
              productName: orderDetails.product,
              quantity: orderDetails.quantity || 1,
              price: 0,
              notes: orderDetails.notes || ''
            }
          }
        });
        console.log('Item added to existing order:', customerPhone);
      }
    } catch (error) {
      console.error('Error creating/updating order:', error);
    }
  }

  async getBusinessConversations(businessId) {
    return await this.conversationRepository.findByBusiness(businessId);
  }

  async getConversationMessages(conversationId, businessId) {
    const conversation = await this.conversationRepository.findById(conversationId);
    
    if (!conversation || conversation.business.toString() !== businessId.toString()) {
      throw new Error('Conversation not found');
    }

    return await this.messageRepository.findByConversation(conversationId);
  }

  // Get image URL from WhatsApp
  async getImageUrl(imageId, business) {
    try {
      const creds = this.getCredentials(business);
      // WhatsApp media URL endpoint
      const url = `https://graph.facebook.com/v17.0/${imageId}`;
      console.log('Fetching image from:', url);
      
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Authorization': `Bearer ${creds.token}`
        }
      });
      
      console.log('Image API response:', JSON.stringify(response.data, null, 2));
      return response.data?.url || null;
    } catch (error) {
      console.error('Error getting image URL:', error.response?.data || error.message);
      return null;
    }
  }

  // Search products for a business
  async searchProducts(businessId, query) {
    const { Product } = require('../models');
    return await Product.find({
      business: businessId,
      isActive: true,
      $text: { $search: query }
    }).limit(5);
  }

  // Search products by criteria
  async searchProductsByCriteria(businessId, criteria) {
    const { Product } = require('../models');
    let query = { business: businessId, isActive: true };

    // If we have keywords, use text search first
    if (criteria.keywords?.length > 0) {
      const searchQuery = criteria.keywords.join(' ');
      const textResults = await Product.find({
        ...query,
        $text: { $search: searchQuery }
      }).limit(5);
      
      if (textResults.length > 0) {
        return textResults;
      }
    }

    // Fallback to field-specific search
    if (criteria.brand) {
      query.brand = new RegExp(criteria.brand, 'i');
    }
    if (criteria.category) {
      query.$or = [
        { category: new RegExp(criteria.category, 'i') },
        { name: new RegExp(criteria.category, 'i') },
        { tags: new RegExp(criteria.category, 'i') }
      ];
    }
    if (criteria.color) {
      query['colors.name'] = new RegExp(criteria.color, 'i');
    }
    if (criteria.size) {
      query['sizes.size'] = criteria.size;
    }
    if (criteria.priceRange?.max) {
      query.price = { $lte: criteria.priceRange.max };
    }
    if (criteria.priceRange?.min) {
      query.price = { ...query.price, $gte: criteria.priceRange.min };
    }

    const results = await Product.find(query).limit(5);
    
    // If still no results, try broader search
    if (results.length === 0 && criteria.category) {
      const broaderResults = await Product.find({
        business: businessId,
        isActive: true,
        $or: [
          { category: new RegExp(criteria.category, 'i') },
          { name: new RegExp(criteria.category, 'i') },
          { brand: new RegExp(criteria.category, 'i') },
          { tags: new RegExp(criteria.category, 'i') },
          { description: new RegExp(criteria.category, 'i') }
        ]
      }).limit(5);
      return broaderResults;
    }

    return results;
  }

  // Send image message via WhatsApp
  async sendImageMessage(business, recipientPhone, imageUrl, caption = '') {
    try {
      const creds = this.getCredentials(business);
      const url = `${this.baseUrl}/${creds.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption
        }
      };

      const response = await this.axiosInstance.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Image sent successfully');
      return response.data;
    } catch (error) {
      console.error('Error sending image:', error.response?.data || error.message);
      // Don't throw - image sending failure shouldn't break the flow
      return null;
    }
  }

  // Send product catalog response
  async sendProductCatalog(business, customerPhone, products) {
    try {
      for (const product of products) {
        // Send product info as text
        const message = `*${product.name}*\n` +
          (product.brand ? `Brand: ${product.brand}\n` : '') +
          `Price: PKR ${product.price.toLocaleString()}\n` +
          (product.sizes?.length > 0 ? `Sizes: ${product.sizes.map(s => s.size).join(', ')}\n` : '') +
          (product.colors?.length > 0 ? `Colors: ${product.colors.map(c => c.name).join(', ')}\n` : '') +
          `\n感兴趣? Reply with "order ${product.name}"`;

        await this.sendMessage(business, customerPhone, message);

        // Send primary image if available
        if (product.images?.length > 0) {
          const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
          if (primaryImage?.url) {
            await this.sendImageMessage(business, customerPhone, primaryImage.url, product.name);
          }
        }

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error sending product catalog:', error);
    }
  }

  // Check if message is an order request
  isOrderRequest(message) {
    const orderKeywords = [
      'order', 'order karo', 'order karna', 'khareedna', 'khareed', 'buy',
      'purchase', 'lena', 'chahiye', 'mangwana', 'book', 'confirm',
      'checkout', 'payment', 'pay', 'bill', 'invoice'
    ];
    const lowerMessage = message.toLowerCase();
    return orderKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Check if message is a greeting or menu request
  isGreetingOrMenu(message) {
    const greetings = [
      'hi', 'hello', 'hey', 'hola', 'salam', 'assalam', 'namaste',
      'menu', 'help', 'options', 'start', 'begin',
      'kya hai', 'kaise ho', 'kya kar rahe ho'
    ];
    const lowerMessage = message.toLowerCase().trim();
    
    // Check for exact matches or if message starts with greeting
    return greetings.some(g => 
      lowerMessage === g || 
      lowerMessage.startsWith(g + ' ') ||
      lowerMessage === g
    );
  }

  // Detect if AI response indicates customer needs human agent transfer
  detectHandoffRequest(aiResponse) {
    if (!aiResponse) return false;
    
    const response = aiResponse.toLowerCase();
    
    const handoffKeywords = [
      'agent se connect',
      'agent se baat',
      'human agent',
      'agent connect',
      'transfer to agent',
      'connect kar raha',
      'please wait',
      'transferring',
      'connecting to',
      'human support',
      'customer support',
      'real person',
      'live agent'
    ];
    
    return handoffKeywords.some(keyword => response.includes(keyword));
  }

  // Start order flow
  async startOrderFlow(business, customerPhone, message, conversation) {
    try {
      const { Product } = require('../models');
      
      // Try to find the product mentioned in the message
      const productCriteria = await aiService.extractProductCriteria(message, business._id);
      let product = null;

      // If they mentioned a specific product, find it
      if (productCriteria.keywords?.length > 0) {
        const searchQuery = productCriteria.keywords.join(' ');
        const products = await Product.find({
          business: business._id,
          isActive: true,
          $text: { $search: searchQuery }
        }).limit(1);
        
        if (products.length > 0) {
          product = products[0];
        }
      }

      // If no product found, ask which product they want
      if (!product) {
        // Get all products and show them
        const products = await Product.find({
          business: business._id,
          isActive: true
        }).limit(6);

        if (products.length === 0) {
          await this.sendMessage(business, customerPhone,
            `Sorry, abhi koi products available nahi hain. 😔\n\nJab products add honge toh aap order kar sakte hain!`
          );
          return true;
        }

        if (products.length === 1) {
          // Only one product, start order with it
          product = products[0];
        } else {
          // Show products using INTERACTIVE LIST
          const listMsg = interactiveService.createProductListMessage(products);
          const sent = await this.sendInteractiveMessage(business, customerPhone, listMsg);
          
          if (!sent) {
            // Fallback to text list
            let productList = `*📦 Kya order karna chahte hain?*\n\n`;
            products.forEach((p, i) => {
              productList += `${i + 1}. *${p.name}*\n`;
              if (p.brand) productList += `   ${p.brand} - `;
              productList += `PKR ${p.price.toLocaleString()}\n\n`;
            });
            productList += `Reply with number or product name`;
            await this.sendMessage(business, customerPhone, productList);
          }

          // Store products in session for selection
          const session = orderFlowService.getSession(business._id, customerPhone);
          session.availableProducts = products;
          session.state = 'selecting_product';
          
          return true;
        }
      }

      // Start order with found product
      if (product) {
        await this.sendProductOrderPrompt(business, customerPhone, product);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error starting order flow:', error);
      return false;
    }
  }

  // Send product order prompt with INTERACTIVE BUTTONS
  async sendProductOrderPrompt(business, customerPhone, product) {
    // Start order flow
    const session = orderFlowService.startOrder(business._id, customerPhone, product);

    // Send product image first
    if (product.images?.length > 0) {
      const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
      if (primaryImage?.url) {
        await this.sendImageMessage(business, customerPhone, primaryImage.url, product.name);
      }
    }

    // Check what options product has and send appropriate interactive message
    if (product.sizes?.length > 0) {
      // Send SIZE selection buttons
      const sizeButtons = product.sizes.slice(0, 3).map(s => ({
        id: `size_${s.size}`,
        title: `Size ${s.size}`
      }));
      
      const interactiveMsg = interactiveService.createReplyButtonsMessage(
        '📏 Select Size',
        `*${product.name}*\n\nPrice: PKR ${product.price.toLocaleString()}\n\nKya size chahiye?`,
        `${product.sizes.length} sizes available`,
        sizeButtons
      );

      const sent = await this.sendInteractiveMessage(business, customerPhone, interactiveMsg);
      
      // If interactive message failed, fallback to text
      if (!sent) {
        const formMessage = formService.createQuickOrderForm(product);
        await this.sendMessage(business, customerPhone, formMessage);
      }
    } else if (product.colors?.length > 0) {
      // Send COLOR selection buttons
      const colorButtons = product.colors.slice(0, 3).map(c => ({
        id: `color_${c.name.toLowerCase()}`,
        title: c.name
      }));
      
      const interactiveMsg = interactiveService.createReplyButtonsMessage(
        '🎨 Select Color',
        `*${product.name}*\n\nPrice: PKR ${product.price.toLocaleString()}\n\nKya color chahiye?`,
        `${product.colors.length} colors available`,
        colorButtons
      );

      await this.sendInteractiveMessage(business, customerPhone, interactiveMsg);
    } else {
      // No sizes or colors - ask quantity with quick buttons
      const interactiveMsg = interactiveService.createQuantityButtonsMessage();
      
      const sent = await this.sendInteractiveMessage(business, customerPhone, interactiveMsg);
      
      if (!sent) {
        await this.sendMessage(business, customerPhone, 
          `*${product.name}*\nPrice: PKR ${product.price.toLocaleString()}\n\n📦 Kitni quantity chahiye?\nReply with number (1-100)`);
      }
    }
  }

  // Process order flow input - handles quick form responses
  async processOrderFlow(business, customerPhone, input, conversation) {
    const session = orderFlowService.getSession(business._id, customerPhone);
    const currentState = session.state;

    console.log('Order flow state:', currentState);
    console.log('Order flow input:', input);

    // Handle product selection
    if (currentState === 'selecting_product') {
      const selectedIndex = parseInt(input) - 1;
      const selectedProduct = session.availableProducts?.[selectedIndex];
      
      if (selectedProduct) {
        await this.sendProductOrderPrompt(business, customerPhone, selectedProduct);
        return true;
      }

      // Try to find by name
      const { Product } = require('../models');
      const searchResult = await Product.find({
        business: business._id,
        isActive: true,
        name: new RegExp(input, 'i')
      }).limit(1);

      if (searchResult.length > 0) {
        await this.sendProductOrderPrompt(business, customerPhone, searchResult[0]);
        return true;
      }

      await this.sendMessage(business, customerPhone, 
        `Sorry, samajh nahi aya. Kripya number ya product ka naam likhen.`);
      return true;
    }

    // Handle quick form response - parse "Size, Color, Quantity" format
    if (currentState === ORDER_STATES.SELECTING_SIZE || 
        currentState === ORDER_STATES.SELECTING_COLOR || 
        currentState === ORDER_STATES.ENTERING_QUANTITY) {
      
      // Try to parse quick form response (e.g., "42, Black, 2" or "42 Black 2")
      const parsed = this.parseQuickOrderForm(input, session);
      
      if (parsed.size) {
        session.order.items[0].size = parsed.size;
      }
      if (parsed.color) {
        session.order.items[0].color = parsed.color;
      }
      if (parsed.quantity) {
        session.order.items[0].quantity = parsed.quantity;
      }

      // Check what info we still need
      const needsSize = session.selectedProduct.sizes?.length > 0 && !session.order.items[0].size;
      const needsColor = session.selectedProduct.colors?.length > 0 && !session.order.items[0].color;
      const needsQuantity = !session.order.items[0].quantity;

      if (needsSize) {
        // Ask for size specifically
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.SELECTING_SIZE);
        const sizeList = session.selectedProduct.sizes.map(s => s.size).join(', ');
        await this.sendMessage(business, customerPhone, 
          `📏 *Size select karein:*\n\nAvailable: *${sizeList}*\n\nReply with size`);
        return true;
      }

      if (needsColor) {
        // Ask for color specifically
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.SELECTING_COLOR);
        const colorList = session.selectedProduct.colors.map(c => c.name).join(', ');
        await this.sendMessage(business, customerPhone, 
          `🎨 *Color select karein:*\n\nAvailable: *${colorList}*\n\nReply with color name`);
        return true;
      }

      if (needsQuantity) {
        // Ask for quantity
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.ENTERING_QUANTITY);
        await this.sendMessage(business, customerPhone, 
          `📦 *Kitni quantity chahiye?*\n\nReply with number (1-100)`);
        return true;
      }

      // All info collected - move to customer details
      orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.COLLECTING_ADDRESS);
      
      // Show what we collected and ask for customer info
      const item = session.order.items[0];
      let summary = `✅ *Order Details:*\n\n`;
      summary += `📦 ${item.productName}\n`;
      if (item.size) summary += `📏 Size: ${item.size}\n`;
      if (item.color) summary += `🎨 Color: ${item.color}\n`;
      summary += `📦 Quantity: ${item.quantity}\n`;
      summary += `💰 Price: PKR ${item.price.toLocaleString()} x ${item.quantity}\n\n`;
      summary += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      summary += `👤 *Apni details bhejein:*\n\n`;
      summary += `Name: Apka pura naam\n`;
      summary += `Address: Pura address with city\n\n`;
      summary += `Example:\n`;
      summary += `Name: Ahmed Ali\n`;
      summary += `Address: House 123, Gulberg, Lahore`;

      await this.sendMessage(business, customerPhone, summary);
      return true;
    }

    // Handle customer info input (Name + Address)
    if (currentState === ORDER_STATES.COLLECTING_ADDRESS) {
      const customerInfo = formService.parseKeyValueResponse(input);
      
      if (customerInfo.name) {
        session.order.customerName = customerInfo.name;
      } else {
        // Assume the whole input is the name if no "Name:" prefix
        session.order.customerName = input.trim();
      }

      if (customerInfo.address) {
        session.order.address = customerInfo.address;
      } else if (!customerInfo.name) {
        // If no parsed address, use second line or whole input as address
        session.order.address = input.trim();
      }

      // Check if we have enough info
      if (session.order.customerName && session.order.address) {
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.CONFIRMING);
        
        // Show confirmation with all details
        const item = session.order.items[0];
        const total = item.price * item.quantity;
        
        let confirmMsg = formService.createOrderConfirmation(
          session.selectedProduct,
          item.size,
          item.color,
          item.quantity,
          {
            name: session.order.customerName,
            address: session.order.address
          }
        );

        await this.sendMessage(business, customerPhone, confirmMsg);
      } else {
        // Ask for missing info
        if (!session.order.customerName) {
          await this.sendMessage(business, customerPhone, 
            `❌ *Name missing hai.*\n\nPlease reply with:\nName: Your name\nAddress: Your address`);
        } else {
          await this.sendMessage(business, customerPhone, 
            `❌ *Address missing hai.*\n\nPlease provide your full address including city.`);
        }
      }
      return true;
    }

    // Handle confirmation
    if (currentState === ORDER_STATES.CONFIRMING) {
      const confirmWords = ['yes', 'haan', 'confirm', 'ha', 'ji', 'yes', 'confirm karo', 'ok', 'thik hai', 'y'];
      const cancelWords = ['cancel', 'no', 'nahi', 'na', 'rukao', 'band karo', 'n'];
      
      const lowerInput = input.toLowerCase().trim();
      
      if (confirmWords.some(word => lowerInput === word || lowerInput.includes(word))) {
        // Create the order
        const order = await this.createOrderFromFlow(business, session);
        
        orderFlowService.clearSession(business._id, customerPhone);

        // Send success message
        const confirmMsg = formService.createOrderSuccessMessage(order._id);
        await this.sendMessage(business, customerPhone, confirmMsg);

        // Create lead
        await this.createLeadIfNotExists(
          business._id,
          null,
          customerPhone,
          session.order.customerName,
          `Ordered: ${session.order.items[0].productName}`,
          { interest: session.order.items[0].productName, intent: 'buying', qualified: true }
        );

        return true;
      } else if (cancelWords.some(word => lowerInput === word || lowerInput.includes(word))) {
        orderFlowService.clearSession(business._id, customerPhone);
        
        await this.sendMessage(business, customerPhone, 
          `❌ *Order cancel kar diya gaya hai.*\n\nKoi baat nahi! Agar baad mein chahiye toh hum yahan hain. 😊\n\nReply *menu* to see products or *hi* to start again.`);
        return true;
      } else {
        // Try to parse as customer info update
        const customerInfo = formService.parseKeyValueResponse(input);
        if (customerInfo.name || customerInfo.address) {
          if (customerInfo.name) session.order.customerName = customerInfo.name;
          if (customerInfo.address) session.order.address = customerInfo.address;
          
          // Show updated confirmation
          const item = session.order.items[0];
          const confirmMsg = formService.createOrderConfirmation(
            session.selectedProduct,
            item.size,
            item.color,
            item.quantity,
            {
              name: session.order.customerName,
              address: session.order.address
            }
          );
          await this.sendMessage(business, customerPhone, confirmMsg);
        } else {
          await this.sendMessage(business, customerPhone, 
            `❌ *Samajh nahi aaya.*\n\n✅ Reply *YES* to confirm order\n❌ Reply *NO* to cancel\n\nOr update your details:\nName: New name\nAddress: New address`);
        }
        return true;
      }
    }

    // Handle size selection
    if (currentState === ORDER_STATES.SELECTING_SIZE) {
      const sizeInput = input.trim();
      const availableSize = session.availableSizes.find(
        s => s.size.toUpperCase() === sizeInput.toUpperCase() || 
             s.size === sizeInput ||
             s.size === parseInt(sizeInput)?.toString()
      );

      if (availableSize) {
        session.order.items[0].size = availableSize.size;
        
        // Move to color or quantity
        if (session.selectedProduct.colors?.length > 0) {
          session.availableColors = session.selectedProduct.colors;
          orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.SELECTING_COLOR);
          
          let colorMsg = `✅ Size: *${availableSize.size}*\n\n`;
          colorMsg += `🎨 *Select Color:*\n`;
          session.selectedProduct.colors.forEach((c, i) => {
            colorMsg += `${i + 1}. ${c.name}\n`;
          });
          colorMsg += `\nReply with color number or name`;
          
          await this.sendMessage(business, customerPhone, colorMsg);
        } else {
          orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.ENTERING_QUANTITY);
          await this.sendMessage(business, customerPhone, 
            `✅ Size: *${availableSize.size}*\n\n📦 *Kitni quantity chahiye?*\nReply with number (1-100)`);
        }
      } else {
        const sizeList = session.availableSizes.map(s => s.size).join(', ');
        await this.sendMessage(business, customerPhone, 
          `❌ Yeh size available nahi hai.\n\n✅ Available sizes: *${sizeList}*\n\nKripya sahi size select karein.`);
      }
      return true;
    }

    // Handle color selection
    if (currentState === ORDER_STATES.SELECTING_COLOR) {
      const colorInput = input.trim().toLowerCase();
      const selectedColor = session.availableColors.find(
        c => c.name.toLowerCase() === colorInput || 
             c.name.toLowerCase().startsWith(colorInput)
      );

      if (selectedColor || !isNaN(parseInt(input))) {
        const color = selectedColor || session.availableColors[parseInt(input) - 1];
        
        if (color) {
          session.order.items[0].color = color.name;
          orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.ENTERING_QUANTITY);

          let msg = `✅ Color: *${color.name}*\n\n`;
          msg += `📦 *Kitni quantity chahiye?*\n`;
          msg += `Reply with number (1-100)`;
          
          await this.sendMessage(business, customerPhone, msg);
        } else {
          const colorList = session.availableColors.map(c => c.name).join(', ');
          await this.sendMessage(business, customerPhone, 
            `❌ Yeh color available nahi hai.\n\n✅ Available colors: *${colorList}*`);
        }
      } else {
        const colorList = session.availableColors.map(c => c.name).join(', ');
        await this.sendMessage(business, customerPhone, 
          `❌ Samajh nahi aya.\n\nAvailable colors: *${colorList}*`);
      }
      return true;
    }

    // Handle quantity input
    if (currentState === ORDER_STATES.ENTERING_QUANTITY) {
      const quantity = parseInt(input.trim());
      
      if (quantity > 0 && quantity <= 100) {
        session.order.items[0].quantity = quantity;
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.COLLECTING_NAME);

        const item = session.order.items[0];
        let msg = `✅ Quantity: *${quantity}*\n\n`;
        msg += `👤 *Apka naam kya hai?*`;
        
        await this.sendMessage(business, customerPhone, msg);
      } else {
        await this.sendMessage(business, customerPhone, 
          `❌ Invalid quantity. Kripya 1-100 ke beech mein number daalein.`);
      }
      return true;
    }

    // Handle name input
    if (currentState === ORDER_STATES.COLLECTING_NAME) {
      if (input.trim().length >= 2) {
        session.order.customerName = input.trim();
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.COLLECTING_ADDRESS);

        await this.sendMessage(business, customerPhone, 
          `✅ Naam: *${input.trim()}*\n\n📍 *Delivery address kya hai?*\n(Pura address likhen)`);
      } else {
        await this.sendMessage(business, customerPhone, 
          `❌ Naam bohot chota hai. Kripya pura naam likhen.`);
      }
      return true;
    }

    // Handle address input
    if (currentState === ORDER_STATES.COLLECTING_ADDRESS) {
      if (input.trim().length >= 10) {
        session.order.address = input.trim();
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.CONFIRMING);

        // Show order summary and ask for confirmation
        const summary = orderFlowService.getOrderSummary(session);
        let confirmMsg = summary + '\n━━━━━━━━━━━━━━━━\n\n';
        confirmMsg += `*Confirm karein?*\n`;
        confirmMsg += `✅ Reply "yes" or "confirm" to place order\n`;
        confirmMsg += `❌ Reply "cancel" to cancel`;

        await this.sendMessage(business, customerPhone, confirmMsg);
      } else {
        await this.sendMessage(business, customerPhone, 
          `❌ Address bohot chota hai. Kripya pura address likhen (City, Area, Street, etc)`);
      }
      return true;
    }

    // Handle confirmation
    if (currentState === ORDER_STATES.CONFIRMING) {
      const confirmWords = ['yes', 'haan', 'confirm', 'ha', 'ji', '✓', 'confirm karo', 'ok', 'thik hai'];
      const cancelWords = ['cancel', 'no', 'nahi', 'na', 'rukao', 'band karo'];
      
      const lowerInput = input.toLowerCase();
      
      if (confirmWords.some(word => lowerInput.includes(word))) {
        // Create the order
        const order = await this.createOrderFromFlow(business, session);
        
        orderFlowService.clearSession(business._id, customerPhone);

        // Send confirmation
        let confirmMsg = `*🎉 Order Confirm ho gaya!*\n\n`;
        confirmMsg += `📦 Order ID: *#${order._id.slice(-6).toUpperCase()}*\n`;
        confirmMsg += `━━━━━━━━━━━━━━━━\n\n`;
        confirmMsg += `*Order Details:*\n`;
        const item = session.order.items[0];
        confirmMsg += `• ${item.productName} ${item.size ? `(Size: ${item.size})` : ''} ${item.color ? `(Color: ${item.color})` : ''}\n`;
        confirmMsg += `• Quantity: ${item.quantity}\n`;
        confirmMsg += `• Total: PKR ${(item.price * item.quantity).toLocaleString()}\n\n`;
        confirmMsg += `📍 Deliver to: ${session.order.address}\n`;
        confirmMsg += `👤 Name: ${session.order.customerName}\n\n`;
        confirmMsg += `Hum jald hi aap se contact karenge delivery ke liye! 📞\n\n`;
        confirmMsg += `*Thank you for your order!* 🙏`;

        await this.sendMessage(business, customerPhone, confirmMsg);

        // Create lead
        await this.createLeadIfNotExists(
          business._id,
          null,
          customerPhone,
          session.order.customerName,
          `Ordered: ${item.productName}`,
          { interest: item.productName, intent: 'buying', qualified: true }
        );

        return true;
      } else if (cancelWords.some(word => lowerInput.includes(word))) {
        orderFlowService.clearSession(business._id, customerPhone);
        
        await this.sendMessage(business, customerPhone, 
          `❌ *Order cancel kar diya gaya hai.*\n\nKoi baat nahi! Agar baad mein chahiye toh hum yahan hain. 😊`);
        return true;
      } else {
        await this.sendMessage(business, customerPhone, 
          `❌ Samajh nahi aaya.\n\n✅ Reply "yes" ya "confirm" to order\n❌ Reply "cancel" to cancel`);
        return true;
      }
    }

    return false;
  }

  // Parse quick order form response
  parseQuickOrderForm(input, session) {
    const result = { size: null, color: null, quantity: null };

    // Split by comma or multiple spaces
    const parts = input.split(/[,\s]+/).filter((p) => p.trim());

    const product = session.selectedProduct;

    for (const part of parts) {
      const trimmed = part.trim();

      // Check if it's a number (could be size or quantity)
      if (!isNaN(trimmed)) {
        const num = parseInt(trimmed, 10);

        // Check if it matches a size
        if (product.sizes?.length > 0) {
          const sizeMatch = product.sizes.find((s) => s.size === trimmed || s.size === num.toString());
          if (sizeMatch) {
            result.size = sizeMatch.size;
            continue;
          }
        }

        // Assume it's quantity (if reasonable)
        if (num > 0 && num <= 100) {
          result.quantity = num;
        }
        continue;
      }

      // Check if it matches a color
      if (product.colors?.length > 0) {
        const colorMatch = product.colors.find(
          (c) =>
            c.name.toLowerCase() === trimmed.toLowerCase() ||
            c.name.toLowerCase().startsWith(trimmed.toLowerCase())
        );
        if (colorMatch) {
          result.color = colorMatch.name;
          continue;
        }
      }

      // Check if it matches a size (string)
      if (product.sizes?.length > 0) {
        const sizeMatch = product.sizes.find((s) => s.size.toLowerCase() === trimmed.toLowerCase());
        if (sizeMatch) {
          result.size = sizeMatch.size;
        }
      }
    }

    return result;
  }

  // Handle button reply from interactive message
  async handleButtonReply(business, customerPhone, buttonReply, conversation) {
    const { Product } = require('../models');
    
    // Prefer raw WhatsApp id (string). `value` may be a number (e.g. qty) — never use it for .startsWith
    const buttonId = String(buttonReply.id != null ? buttonReply.id : '');
    const buttonTitle = buttonReply.title || '';

    // Size button
    if (buttonId.startsWith('size_')) {
      const size = buttonId.replace('size_', '');
      
      if (!orderFlowService.isInOrderFlow(business._id, customerPhone)) {
        return false;
      }

      const session = orderFlowService.getSession(business._id, customerPhone);
      session.order.items[0].size = size;
      
      // Move to color or quantity
      if (session.selectedProduct.colors?.length > 0) {
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.SELECTING_COLOR);
        
        const colorButtons = session.selectedProduct.colors.slice(0, 3).map((c) => ({
          id: `color_${c.name.toLowerCase()}`,
          title: c.name
        }));

        const interactiveMsg = interactiveService.createReplyButtonsMessage(
          '🎨 Select Color',
          `Size: *${size}*\n\nKya color chahiye?`,
          `${session.selectedProduct.colors.length} colors available`,
          colorButtons
        );

        await this.sendInteractiveMessage(business, customerPhone, interactiveMsg);
      } else {
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.ENTERING_QUANTITY);
        
        const qtyButtons = [
          { id: 'qty_1', title: '1 Piece' },
          { id: 'qty_2', title: '2 Pieces' },
          { id: 'qty_3', title: '3 Pieces' }
        ];

        const interactiveMsg = {
          type: 'interactive',
          interactive: {
            type: 'button',
            header: { type: 'text', text: '📦 Select Quantity' },
            body: { text: `Size: *${size}*\n\nKitni quantity chahiye?` },
            footer: { text: 'Or type a number' },
            action: {
              buttons: qtyButtons.map(btn => ({
                type: 'reply',
                reply: { id: btn.id, title: btn.title }
              }))
            }
          }
        };

        await this.sendInteractiveMessage(business, customerPhone, interactiveMsg);
      }
      return true;
    }

    // Color button
    if (buttonId.startsWith('color_')) {
      const color = buttonId.replace('color_', '');
      
      if (!orderFlowService.isInOrderFlow(business._id, customerPhone)) {
        return false;
      }

      const session = orderFlowService.getSession(business._id, customerPhone);
      // Find color name (capitalize first letter)
      const colorName = color.charAt(0).toUpperCase() + color.slice(1);
      session.order.items[0].color = colorName;
      
      orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.ENTERING_QUANTITY);
      
      const qtyButtons = [
        { id: 'qty_1', title: '1 Piece' },
        { id: 'qty_2', title: '2 Pieces' },
        { id: 'qty_3', title: '3 Pieces' }
      ];

      const interactiveMsg = {
        type: 'interactive',
        interactive: {
          type: 'button',
          header: { type: 'text', text: '📦 Select Quantity' },
          body: { text: `Color: *${colorName}*\n\nKitni quantity chahiye?` },
          footer: { text: 'Or type a number' },
          action: {
            buttons: qtyButtons.map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title }
            }))
          }
        }
      };

      await this.sendInteractiveMessage(business, customerPhone, interactiveMsg);
      return true;
    }

    // Quantity button
    if (buttonId.startsWith('qty_')) {
      const qty = parseInt(buttonId.replace('qty_', ''));
      
      if (!orderFlowService.isInOrderFlow(business._id, customerPhone)) {
        return false;
      }

      const session = orderFlowService.getSession(business._id, customerPhone);
      session.order.items[0].quantity = qty;
      
      // Move to customer info
      orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.COLLECTING_ADDRESS);
      
      // Show what we collected and ask for customer details
      const item = session.order.items[0];
      let summary = `✅ *Order Details:*\n\n`;
      summary += `📦 ${item.productName}\n`;
      if (item.size) summary += `📏 Size: ${item.size}\n`;
      if (item.color) summary += `🎨 Color: ${item.color}\n`;
      summary += `📦 Quantity: ${item.quantity}\n`;
      summary += `💰 Total: PKR ${(item.price * item.quantity).toLocaleString()}\n\n`;
      summary += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      summary += `👤 *Apni details type karein:*\n\n`;
      summary += `Name: Apka pura naam\n`;
      summary += `Address: Pura address with city\n\n`;
      summary += `Example:\n`;
      summary += `Name: Ahmed Ali\n`;
      summary += `Address: House 123, Gulberg, Lahore`;

      await this.sendMessage(business, customerPhone, summary);
      return true;
    }

    // Confirm buttons
    if (buttonId.startsWith('confirm_')) {
      const action = buttonId.replace('confirm_', '');
      
      if (!orderFlowService.isInOrderFlow(business._id, customerPhone)) {
        return false;
      }

      const session = orderFlowService.getSession(business._id, customerPhone);

      if (action === 'yes') {
        // Create the order
        const order = await this.createOrderFromFlow(business, session);
        orderFlowService.clearSession(business._id, customerPhone);

        // Send success message with buttons
        const oid = String(order._id || '');
        const successMsg = {
          type: 'interactive',
          interactive: {
            type: 'button',
            header: { type: 'text', text: '🎉 Order Placed!' },
            body: { text: `Order ID: *#${oid.slice(-8).toUpperCase()}*\n\nThank you for your order! 🙏` },
            footer: { text: 'Thank you for shopping with us!' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'more_products', title: '🛍️ More Products' } },
                { type: 'reply', reply: { id: 'new_order', title: '🛒 New Order' } },
                { type: 'reply', reply: { id: 'track_order', title: '📍 Track Order' } }
              ]
            }
          }
        };

        await this.sendInteractiveMessage(business, customerPhone, successMsg);

        // Create lead
        await this.createLeadIfNotExists(
          business._id,
          null,
          customerPhone,
          session.order.customerName,
          `Ordered: ${session.order.items[0].productName}`,
          { interest: session.order.items[0].productName, intent: 'buying', qualified: true }
        );
      } else if (action === 'no') {
        orderFlowService.clearSession(business._id, customerPhone);
        
        await this.sendMessage(business, customerPhone, 
          `❌ *Order cancel kar diya gaya hai.*\n\nKoi baat nahi! Agar baad mein chahiye toh hum yahan hain. 😊`);
      } else if (action === 'edit') {
        // Go back to customer info
        orderFlowService.updateState(business._id, customerPhone, ORDER_STATES.COLLECTING_ADDRESS);
        
        await this.sendMessage(business, customerPhone, 
          `✏️ *Edit your details:*\n\nName: Apka pura naam\nAddress: Pura address with city`);
      }
      return true;
    }

    // Quick action buttons (after order placed)
    if (buttonId.startsWith('action_') || 
        buttonId === 'more_products' || buttonId === 'new_order' || 
        buttonId === 'track_order' || buttonId === 'recent_orders') {
      
      const action = buttonId.replace('action_', '');
      
      if (action === 'more_products' || action === 'new_order' || action === 'products') {
        // Show product menu
        const products = await Product.find({ business: business._id, isActive: true }).limit(6);
        if (products.length > 0) {
          const listMsg = interactiveService.createProductListMessage(products);
          await this.sendInteractiveMessage(business, customerPhone, listMsg);
        } else {
          await this.sendMessage(business, customerPhone, 'Abhi koi products available nahi hain.');
        }
      } else if (action === 'track_order') {
        // Show recent orders first, then ask for order ID
        const recentOrdersMsg = await orderTrackingService.createRecentOrdersMessage(business._id, customerPhone);
        
        if (recentOrdersMsg) {
          await this.sendMessage(business, customerPhone, recentOrdersMsg);
        } else {
          await this.sendMessage(business, customerPhone, 
            `📍 *Order Tracking*\n\nApna Order ID bhejein taake hum track kar sakein.\n\nExample: #A1B2C3D4\nYa: FEED4562`);
        }
      } else if (action === 'recent_orders') {
        // Show recent orders
        const recentOrdersMsg = await orderTrackingService.createRecentOrdersMessage(business._id, customerPhone);
        
        if (recentOrdersMsg) {
          await this.sendMessage(business, customerPhone, recentOrdersMsg);
        } else {
          await this.sendMessage(business, customerPhone, 
            `📋 *Recent Orders*\n\nAbhi tak koi orders nahi hain.\n\nJab aap order karenge toh yahan dikhenge.`);
        }
      } else if (action === 'support') {
        await this.sendMessage(business, customerPhone,
          `💬 *Support*\n\nHum aapki madad ke liye hazir hain!\n\nApna sawal likhein ya humein call karein.`);
      }
      return true;
    }

    // Order status/timeline button handlers
    if (buttonId.startsWith('status_') || buttonId.startsWith('timeline_')) {
      const orderId = buttonId.replace('status_', '').replace('timeline_', '');
      const showTimeline = buttonId.startsWith('timeline_');
      
      const order = await orderTrackingService.findOrder(orderId);
      
      if (order) {
        // Check if order belongs to this business
        const orderBusinessId = order.business?._id?.toString() || order.business?.toString();
        
        if (orderBusinessId === business._id.toString()) {
          const trackingMessage = orderTrackingService.createTrackingMessage(order);
          await this.sendMessage(business, customerPhone, trackingMessage);
        } else {
          await this.sendMessage(business, customerPhone, '❌ Yeh order hamare system mein nahi mili.');
        }
      } else {
        await this.sendMessage(business, customerPhone, '❌ Order not found. Kripya sahi order ID check karein.');
      }
      return true;
    }

    return false;
  }

  // Handle list reply from product selection
  async handleListReply(business, customerPhone, listReply, conversation) {
    const { Product } = require('../models');

    if (listReply.type === 'product') {
      const product = await Product.findById(listReply.productId);
      
      if (product) {
        await this.sendProductOrderPrompt(business, customerPhone, product);
        return true;
      }
    }

    return false;
  }

  // Handle order tracking request
  async handleTrackingRequest(business, customerPhone, message) {
    try {
      const orderId = orderTrackingService.extractOrderId(message);
      
      console.log('Looking up order ID:', orderId);
      
      if (orderId) {
        // Find the order
        const order = await orderTrackingService.findOrder(orderId);
        
        if (order) {
          // Check if order belongs to this business
          const orderBusinessId = order.business?._id?.toString() || order.business?.toString();
          const currentBusinessId = business._id.toString();
          
          if (orderBusinessId === currentBusinessId) {
            // Create and send tracking message
            const trackingMessage = orderTrackingService.createTrackingMessage(order);
            const sentText = await this.sendMessage(business, customerPhone, trackingMessage);
            if (!sentText) return true;

            // Also send status buttons for quick actions
            const statusButtons = orderTrackingService.createOrderStatusButtons(order._id);
            await this.sendInteractiveMessage(business, customerPhone, statusButtons);

            return true;
          } else {
            // Order exists but belongs to another business
            await this.sendMessage(business, customerPhone,
              `❌ *Order not found*\n\nYeh order ID hamare system mein nahi mili.\n\nKripya sahi order ID check karein.`);
            return true;
          }
        } else {
          // Order not found
          await this.sendMessage(business, customerPhone,
            `❌ *Order not found*\n\nOrder ID *#${orderId}* hamare system mein nahi mili.\n\nKripya sahi order ID bhejein ya customer support se contact karein.`);
          return true;
        }
      } else {
        // No order ID extracted - show recent orders if any
        const recentOrdersMsg = await orderTrackingService.createRecentOrdersMessage(business._id, customerPhone);
        
        if (recentOrdersMsg) {
          await this.sendMessage(business, customerPhone, recentOrdersMsg);
        } else {
          await this.sendMessage(business, customerPhone,
            `📦 *Order Tracking*\n\nApna Order ID bhejein taake hum track kar sakein.\n\nExample:\n• #90C15845\n• 90C15845\n• track 90C15845`);
        }
        return true;
      }
    } catch (error) {
      console.error('Error handling tracking request:', error.message);
      logWhatsAppGraphError('handleTrackingRequest', error);
      if (!isWhatsAppTokenError(error)) {
        await this.sendMessage(
          business,
          customerPhone,
          `❌ *Error*\n\nTracking mein problem aayi. Kripya baad mein try karein.`
        );
      }
      return isWhatsAppTokenError(error);
    }
  }

  // Create order from flow
  async createOrderFromFlow(business, session) {
    const item = session.order.items[0];
    const totalAmount = item.price * item.quantity;

    const order = await this.orderRepository.create({
      business: business._id,
      customerPhone: session.order.customerPhone,
      customerName: session.order.customerName,
      items: [{
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color
      }],
      totalAmount,
      status: 'pending',
      shippingAddress: {
        fullAddress: session.order.address
      },
      notes: 'Order placed via WhatsApp AI assistant',
      orderSource: 'whatsapp'
    });

    return order;
  }

  // Send test message to verify connection
  async sendTestMessage(token, phoneNumberId, toPhone, message) {
    try {
      const url = `${this.baseUrl}/${phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      };

      const response = await this.axiosInstance.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Test message sent successfully');
      return response.data;
    } catch (error) {
      logWhatsAppGraphError('sendTestMessage', error);
      return null;
    }
  }
}

module.exports = new WhatsAppService();