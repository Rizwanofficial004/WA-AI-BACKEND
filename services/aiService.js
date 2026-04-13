// AI Service - Upgraded with OpenRouter Model Switching
// Supports multiple models, conversation context, and token tracking

const axios = require('axios');
const https = require('https');
const { KnowledgeBaseRepository, BusinessRepository } = require('../repositories');

// Available models on OpenRouter
const AVAILABLE_MODELS = {
  'gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    maxTokens: 16384,
    costPer1kTokens: 0.00015,
    supportsVision: true,
    recommended: true
  },
  'gpt-4o': {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    maxTokens: 128000,
    costPer1kTokens: 0.005,
    supportsVision: true
  },
  'claude-3-haiku': {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    maxTokens: 200000,
    costPer1kTokens: 0.00025,
    supportsVision: true
  },
  'claude-3-sonnet': {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    maxTokens: 200000,
    costPer1kTokens: 0.003,
    supportsVision: true
  },
  'gemini-pro': {
    id: 'google/gemini-pro',
    name: 'Gemini Pro',
    maxTokens: 32768,
    costPer1kTokens: 0.000125,
    supportsVision: false
  },
  'gemini-flash': {
    id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    maxTokens: 1048576,
    costPer1kTokens: 0.000075,
    supportsVision: true
  },
  'llama-3-70b': {
    id: 'meta-llama/llama-3-70b-instruct',
    name: 'Llama 3 70B',
    maxTokens: 8192,
    costPer1kTokens: 0.00059,
    supportsVision: false
  },
  'mistral-large': {
    id: 'mistralai/mistral-large-latest',
    name: 'Mistral Large',
    maxTokens: 32768,
    costPer1kTokens: 0.002,
    supportsVision: false
  }
};

class AIService {
  constructor() {
    this.knowledgeBaseRepository = new KnowledgeBaseRepository();
    this.businessRepository = new BusinessRepository();
    this.conversationContexts = new Map(); // In-memory context cache
    
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({ family: 4 })
    });
    
    this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  /**
   * Get model configuration for a business
   */
  getModelConfig(businessId) {
    // Check business-specific model in cache or config
    // For now, use default or environment variable
    const modelKey = process.env.DEFAULT_AI_MODEL || 'gpt-4o-mini';
    return AVAILABLE_MODELS[modelKey] || AVAILABLE_MODELS['gpt-4o-mini'];
  }

  /**
   * Get model by key
   */
  getModel(modelKey) {
    return AVAILABLE_MODELS[modelKey] || null;
  }

  /**
   * Get all available models
   */
  getAvailableModels() {
    return Object.entries(AVAILABLE_MODELS).map(([key, model]) => ({
      key,
      ...model
    }));
  }

  /**
   * Get AI API key for a business (from DB) with env fallback
   */
  async getApiKey(businessId) {
    if (businessId) {
      try {
        const business = await this.businessRepository.findById(businessId);
        if (business?.aiApiKey) {
          return business.aiApiKey;
        }
      } catch (err) {
        // fall through to env fallback
      }
    }
    return process.env.OPENROUTER_API_KEY || null;
  }

  /**
   * Chat completion with OpenRouter
   */
  async chatCompletion(messages, options = {}) {
    try {
      const apiKey = await this.getApiKey(options.businessId);
      if (!apiKey) {
        throw new Error('AI_API_KEY not configured. Please set your AI API Key in business settings.');
      }

      const modelConfig = this.getModelConfig(options.businessId);
      const model = options.model || modelConfig.id;
      
      const response = await this.axiosInstance.post(
        `${this.baseURL}/chat/completions`,
        {
          model,
          messages,
          max_tokens: options.maxTokens || 500,
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? 1,
          stream: false
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_REFERER || 'http://localhost:3002',
            'X-Title': process.env.APP_TITLE || 'AI WhatsApp Assistant'
          },
          timeout: options.timeout || 30000
        }
      );

      return {
        success: true,
        content: response.data.choices[0]?.message?.content?.trim() || '',
        usage: response.data.usage || {},
        model: response.data.model
      };
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error('[AI] Chat completion error:', {
        status,
        data: JSON.stringify(data),
        message: error.message,
        code: error.code
      });
      return {
        success: false,
        content: '',
        error: data?.error?.message || error.message || 'Unknown AI error'
      };
    }
  }

  /**
   * Search knowledge base for relevant context
   */
  async searchKnowledgeBase(businessId, query, k = 3) {
    try {
      const knowledgeBaseItems = await this.knowledgeBaseRepository.findByBusiness(businessId);
      
      if (knowledgeBaseItems.length === 0) {
        return [];
      }

      // Keyword matching with scoring
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      const scored = knowledgeBaseItems.map(item => {
        const contentLower = item.content.toLowerCase();
        const titleLower = item.title.toLowerCase();
        let score = 0;
        
        queryWords.forEach(word => {
          // Title matches score higher
          if (titleLower.includes(word)) score += 5;
          // Content matches
          if (contentLower.includes(word)) score += 2;
          // Tag matches
          if (item.tags?.some(tag => tag.toLowerCase().includes(word))) score += 3;
        });
        
        return {
          content: item.content,
          title: item.title,
          category: item.category,
          score
        };
      });

      // Sort by score and return top k
      return scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    } catch (error) {
      console.error('[AI] Error searching knowledge base:', error);
      return [];
    }
  }

  /**
   * Generate response with context and conversation history
   */
  async generateResponse(businessId, customerMessage, conversationHistory = [], options = {}) {
    try {
      const business = await this.businessRepository.findById(businessId);
      if (!business) {
        throw new Error('Business not found');
      }

      // Search knowledge base for relevant context
      const relevantDocs = await this.searchKnowledgeBase(businessId, customerMessage);
      
      let context = '';
      if (relevantDocs.length > 0) {
        context = relevantDocs.map(doc => `[${doc.title}]: ${doc.content}`).join('\n\n');
      }

      // Build system message
      const systemMessage = this._buildSystemMessage(business, context);

      // Build messages array with conversation history
      const messages = this._buildMessagesArray(systemMessage, conversationHistory, customerMessage);

      // Call AI
      const result = await this.chatCompletion(messages, {
        businessId,
        maxTokens: options.maxTokens || 500,
        temperature: options.temperature ?? 0.7
      });

      if (!result.success) {
        return {
          success: false,
          response: 'Maaf kijiye, abhi main aapka jawab nahi de pa raha. Mehrbani baad mein try karein ya support se contact karein.',
          error: result.error
        };
      }

      return {
        success: true,
        response: result.content,
        usage: result.usage,
        model: result.model,
        sources: relevantDocs.map(doc => ({
          title: doc.title,
          category: doc.category
        }))
      };
    } catch (error) {
      console.error('[AI] Error generating response:', error);
      return {
        success: false,
        response: 'Sorry, I am having trouble processing your request. Please try again later.',
        error: error.message
      };
    }
  }

  /**
   * Get business-type-specific prompt additions
   */
  _getBusinessTypePrompt(businessType, settings) {
    const typePrompts = {
      ecommerce: {
        capabilities: ['product information', 'pricing', 'order placement', 'order tracking', 'return/exchange'],
        keyPhrases: ['order', 'buy', 'price', 'available', 'stock', 'delivery'],
        greeting: 'You help customers with online shopping inquiries.'
      },
      restaurant: {
        capabilities: ['menu items', 'reservations', 'delivery', 'special offers', 'dietary info'],
        keyPhrases: ['menu', 'order', 'reserve', 'delivery', 'tables', 'food'],
        greeting: 'You help customers with restaurant inquiries, reservations, and food orders.'
      },
      salon: {
        capabilities: ['services offered', 'pricing', 'appointments', 'availability', 'stylists'],
        keyPhrases: ['appointment', 'booking', 'haircut', 'treatment', 'stylist', 'schedule'],
        greeting: 'You help customers with salon appointments, services, and bookings.'
      },
      medical: {
        capabilities: ['appointments', 'services', 'doctors', 'timings', 'emergency'],
        keyPhrases: ['appointment', 'doctor', 'timing', 'checkup', 'emergency', 'fee'],
        greeting: 'You help patients with appointment bookings and general medical inquiries. NEVER give medical advice.'
      },
      real_estate: {
        capabilities: ['property listings', 'pricing', 'viewings', 'features', 'location'],
        keyPhrases: ['property', 'house', 'apartment', 'buy', 'rent', 'viewing', 'location'],
        greeting: 'You help customers with real estate inquiries, property viewings, and listings.'
      },
      automotive: {
        capabilities: ['vehicle information', 'test drives', 'financing', 'services', 'availability'],
        keyPhrases: ['car', 'vehicle', 'test drive', 'price', 'model', 'finance'],
        greeting: 'You help customers with vehicle inquiries, test drives, and automotive services.'
      },
      education: {
        capabilities: ['courses', 'admissions', 'fees', 'schedule', 'certifications'],
        keyPhrases: ['course', 'admission', 'fee', 'class', 'schedule', 'certificate'],
        greeting: 'You help students with course information, admissions, and academic inquiries.'
      },
      travel: {
        capabilities: ['packages', 'destinations', 'booking', 'pricing', 'itineraries'],
        keyPhrases: ['trip', 'package', 'destination', 'booking', 'travel', 'flight'],
        greeting: 'You help customers with travel packages, bookings, and destination information.'
      },
      other: {
        capabilities: [],
        keyPhrases: [],
        greeting: 'You are a helpful customer service assistant for this business.'
      }
    };

    const typeConfig = typePrompts[businessType] || typePrompts.other;
    
    let prompt = `BUSINESS TYPE: ${businessType.toUpperCase()}\n`;
    prompt += `${typeConfig.greeting}\n`;
    
    if (typeConfig.capabilities.length > 0) {
      prompt += `\nYour key capabilities: ${typeConfig.capabilities.join(', ')}.\n`;
    }
    
    if (settings.enableProductSearch || settings.takeOrders) {
      prompt += `\nThis business has product/order capabilities enabled.`;
    }
    
    if (settings.enableAppointmentBooking) {
      prompt += `\nThis business supports appointment booking.`;
    }
    
    if (settings.enableQuoteRequests) {
      prompt += `\nThis business supports quote/estimate requests.`;
    }

    return prompt;
  }

  /**
   * Build system message with business context
   */
  _buildSystemMessage(business, knowledgeContext) {
    const personality = business.aiPersonality || 'Be friendly, professional, and helpful.';
    const businessTypePrompt = this._getBusinessTypePrompt(business.businessType || 'other', business.settings || {});
    
    let systemMessage = `You are an AI customer service assistant.

Business: ${business.name}
${business.description ? `Description: ${business.description}` : ''}
${business.category ? `Category: ${business.category}` : ''}

${businessTypePrompt}

Your personality: ${personality}

IMPORTANT RULES - FOLLOW THESE STRICTLY:
1. ALWAYS check the Knowledge Base first for ANY information about products, services, pricing, policies
2. If customer asks about products, services, pricing, availability - ALWAYS use Knowledge Base
3. NEVER say "I don't know" or "I don't have that information" - always check Knowledge Base
4. When customer asks for human help ("agent", "support", "help", "baat karo") - respond with: "Main aapko agent se connect kar raha hoon.片刻 please wait..."
5. Respond in the same language as the customer (Urdu/Roman Urdu or English)
6. Keep responses SHORT and CONVERSATIONAL (2-3 sentences max)
7. DO NOT make up any information - always use Knowledge Base when available
8. Be helpful, polite, and try to solve customer issues first before transferring to agent
9. DO NOT provide personal information about the business owner or staff
10. If the business has custom quick actions (menu options), guide customers to use them

EXAMPLES OF GOOD RESPONSES:
- Customer: "kitna price hai?" 
  Response: "[Check Knowledge Base and respond] Ye product PKR XX,XXX mein available hai. Order karna hai?"

- Customer: "appointment leni hai"
  Response: "Sure! Kaunsa service ke liye appointment chahiye? Aaj ya kal?"

- Customer: "agent se baat karo"
  Response: "Sure! Main aapko agent se connect kar raha hoon. Please wait..."
`;

    if (knowledgeContext) {
      systemMessage += `\n\nKNOWLEDGE BASE (Use this information for ALL product/service questions):\n${knowledgeContext}\n\nIMPORTANT: Always reference Knowledge Base information when answering questions!`;
    }

    return systemMessage;
  }

  /**
   * Build messages array with conversation history
   */
  _buildMessagesArray(systemMessage, conversationHistory, currentMessage) {
    const messages = [
      { role: 'system', content: systemMessage }
    ];

    // Add conversation history (last 10 messages for context)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      
      console.log(`[AI] Building context with ${recentHistory.length} messages`);
      
      recentHistory.forEach((msg, idx) => {
        if (msg.sender === 'customer') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.sender === 'ai' || msg.sender === 'agent') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      });
      
      console.log(`[AI] Total messages to AI: ${messages.length} (system + history + current)`);
    } else {
      console.log(`[AI] No conversation history found`);
    }

    // Add current message
    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }

  /**
   * Categorize message intent
   */
  async categorizeMessage(message, businessId) {
    try {
      const result = await this.chatCompletion(
        [
          {
            role: 'system',
            content: `Analyze the customer message and return ONLY one word (no explanation):
- lead: If customer shows interest, asks about products/services, pricing, availability
- order: If customer wants to buy, place order, or confirm purchase
- question: If customer is asking general questions
- complaint: If customer has an issue or complaint
- track: If customer wants to track order status
- general: If just greeting or casual chat

Examples:
"Mujhe yeh jacket pasand aayi" → lead
"Order karna hai" → order
"Hello" → general
"Mera order kahan hai?" → track`
          },
          { role: 'user', content: message }
        ],
        { maxTokens: 10, temperature: 0, businessId }
      );

      const category = result.content?.toLowerCase()?.trim();
      const validCategories = ['lead', 'order', 'question', 'complaint', 'track', 'general'];
      
      return validCategories.includes(category) ? category : 'general';
    } catch (error) {
      console.error('[AI] Error categorizing message:', error);
      return 'general';
    }
  }

  /**
   * Extract order details from message
   */
  async extractOrderDetails(message, businessId) {
    try {
      const result = await this.chatCompletion(
        [
          {
            role: 'system',
            content: `Extract order details from customer message. Return valid JSON only:
{
  "product": "product name or null",
  "quantity": number or 1,
  "notes": "any special requests"
}
If no order details found, return: {"product": null, "quantity": 1, "notes": ""}`
          },
          { role: 'user', content: message }
        ],
        { maxTokens: 100, temperature: 0, businessId }
      );

      try {
        return JSON.parse(result.content);
      } catch {
        return { product: null, quantity: 1, notes: '' };
      }
    } catch (error) {
      console.error('[AI] Error extracting order details:', error);
      return { product: null, quantity: 1, notes: '' };
    }
  }

  /**
   * Extract lead information from message
   */
  async extractLeadInfo(message, conversationHistory = [], businessId) {
    try {
      const historyText = conversationHistory
        .slice(-5)
        .map(m => `${m.sender}: ${m.content}`)
        .join('\n');

      const result = await this.chatCompletion(
        [
          {
            role: 'system',
            content: `Extract potential customer interest from this conversation. Return valid JSON:
{
  "interest": "what they are interested in",
  "intent": "buying" or "inquiry" or "comparison",
  "qualified": true or false
}`
          },
          { role: 'user', content: `Recent messages:\n${historyText}\n\nLatest: ${message}` }
        ],
        { maxTokens: 100, temperature: 0, businessId }
      );

      try {
        return JSON.parse(result.content);
      } catch {
        return { interest: message, intent: 'inquiry', qualified: false };
      }
    } catch (error) {
      console.error('[AI] Error extracting lead info:', error);
      return { interest: message, intent: 'inquiry', qualified: false };
    }
  }

  /**
   * Extract product search criteria
   */
  async extractProductCriteria(message, businessId) {
    try {
      const result = await this.chatCompletion(
        [
          {
            role: 'system',
            content: `Extract product search criteria from customer message. Return valid JSON:
{
  "isProductSearch": true/false,
  "brand": "brand name or null",
  "category": "category or null",
  "color": "color or null",
  "size": "size or null",
  "priceRange": {"min": number or null, "max": number or null},
  "keywords": ["search", "keywords"]
}

Consider product search when customer wants to SEE, VIEW, SHOW, or BUY products.`
          },
          { role: 'user', content: message }
        ],
        { maxTokens: 200, temperature: 0, businessId }
      );

      try {
        return JSON.parse(result.content);
      } catch {
        return { isProductSearch: false, brand: null, category: null, color: null, size: null, priceRange: { min: null, max: null }, keywords: [] };
      }
    } catch (error) {
      console.error('[AI] Error extracting product criteria:', error);
      return { isProductSearch: false, brand: null, category: null, color: null, size: null, priceRange: { min: null, max: null }, keywords: [] };
    }
  }

  /**
   * Analyze image using vision model
   */
  async analyzeImage(imageUrl, businessId) {
    try {
      const apiKey = await this.getApiKey(businessId);
      if (!apiKey) {
        throw new Error('AI_API_KEY not configured');
      }

      const modelConfig = this.getModelConfig(businessId);
      
      // Use vision-capable model
      const visionModel = modelConfig.supportsVision 
        ? modelConfig.id 
        : 'openai/gpt-4o-mini';

      const response = await this.axiosInstance.post(
        `${this.baseURL}/chat/completions`,
        {
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this product image and extract details. Return ONLY valid JSON:
{
  "productType": "product type (shoes, shirt, bag, laptop, phone, etc)",
  "brand": "brand name if visible or null",
  "color": "main color(s)",
  "keywords": ["search", "keywords"]
}`
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          max_tokens: 200
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_REFERER || 'http://localhost:3002',
            'X-Title': process.env.APP_TITLE || 'AI WhatsApp Assistant'
          }
        }
      );

      const content = response.data.choices[0]?.message?.content?.trim() || '';
      
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('[AI] Failed to parse image analysis JSON:', e);
        }
      }
      
      return { productType: 'unknown', brand: null, color: null, keywords: [] };
    } catch (error) {
      console.error('[AI] Error analyzing image:', error.response?.data || error.message);
      return { productType: 'unknown', brand: null, color: null, keywords: [] };
    }
  }

  /**
   * Generate product recommendation message
   */
  async generateProductRecommendation(products, customerRequest, businessId) {
    try {
      const productList = products.map((p, i) => 
        `${i + 1}. ${p.name} - ${p.brand || 'No brand'} - PKR ${p.price.toLocaleString()}`
      ).join('\n');

      const result = await this.chatCompletion(
        [
          {
            role: 'system',
            content: `You are a helpful sales assistant. Write a friendly message recommending products. Be enthusiastic and helpful. Use emojis. Keep it short. Respond in the same language as the customer request.`
          },
          { 
            role: 'user', 
            content: `Customer wants: ${customerRequest}\n\nAvailable products:\n${productList}\n\nWrite a recommendation message.`
          }
        ],
        { maxTokens: 300, temperature: 0.7, businessId }
      );

      return result.success ? result.content : 'Here are some great options for you! 😊';
    } catch (error) {
      console.error('[AI] Error generating recommendation:', error);
      return 'Here are some great options for you! 😊';
    }
  }

  // Knowledge base CRUD methods (unchanged)
  async addKnowledge(businessId, knowledgeData) {
    return await this.knowledgeBaseRepository.create({
      business: businessId,
      ...knowledgeData
    });
  }

  async updateKnowledge(knowledgeId, businessId, updateData) {
    return await this.knowledgeBaseRepository.updateById(knowledgeId, updateData);
  }

  async deleteKnowledge(knowledgeId, businessId) {
    await this.knowledgeBaseRepository.deleteById(knowledgeId);
    return { message: 'Knowledge deleted successfully' };
  }

  async getKnowledgeBase(businessId, options = {}) {
    return await this.knowledgeBaseRepository.findByBusiness(businessId, options);
  }
}

module.exports = new AIService();
