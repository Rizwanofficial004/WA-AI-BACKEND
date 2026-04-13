const { KnowledgeBase } = require('../models');

class KnowledgeBaseService {
  
  // Universal FAQs for all business types
  getUniversalFAQs() {
    return [
      {
        title: 'Contact Human Agent',
        content: 'Agar aapko aur help chahiye ya koi complicated issue hai, toh "human agent" ya "agent se baat karo" likhein. Hum aapko team member se connect kar denge.',
        category: 'faq',
        tags: ['agent', 'human', 'support', 'help', 'baat karo']
      },
      {
        title: 'Business Hours',
        content: 'Humare business hours hain: Monday to Saturday, 9 AM se 6 PM. Sunday closed. Emergency cases ke liye please agent se contact karein.',
        category: 'faq',
        tags: ['hours', 'time', 'open', 'close', 'timing']
      },
      {
        title: 'Location & Address',
        content: 'Humare office ka address humari website pe available hai. Visit karne se pehle appointment book karein.',
        category: 'faq',
        tags: ['location', 'address', 'where', 'office', 'find']
      }
    ];
  }

  // Get business-type-specific knowledge
  getTypeSpecificKnowledge(businessType) {
    const knowledgeByType = {
      ecommerce: [
        {
          title: 'Product Sizes',
          content: 'Hamare products different sizes mein available hain. Size chart website pe available hai. Order ke waqt apni size specify karein.',
          category: 'faq',
          tags: ['sizes', 'dimensions', 'size chart', 'fit']
        },
        {
          title: 'Available Colors',
          content: 'Products multiple colors mein available hain. Color availability stock pe depend karti hai. Order ke waqt aap apna pasandida color specify kar sakte hain.',
          category: 'faq',
          tags: ['colors', 'colour', 'available']
        },
        {
          title: 'Product Prices',
          content: 'Product ki prices website pe di gayi hain. Prices PKR mein hain. Discounts aur offers ke liye humare broadcasts check karein.',
          category: 'faq',
          tags: ['price', 'cost', 'discount', 'offer']
        },
        {
          title: 'Delivery Time',
          content: 'Normal delivery 3-5 business days mein hoti hai. Major cities mein same day delivery bhi available hai.',
          category: 'faq',
          tags: ['delivery', 'shipping', 'time', 'days']
        },
        {
          title: 'Payment Methods',
          content: 'Hum COD (Cash on Delivery), Bank Transfer, aur JazzCash/EasyPaisa accept karte hain.',
          category: 'faq',
          tags: ['payment', 'cod', 'bank', 'jazzcash', 'easypaisa']
        },
        {
          title: 'Return Policy',
          content: 'Agar product damaged ya defective hai toh 7 din ke andar return kar sakte hain. Original packaging honi chahiye.',
          category: 'faq',
          tags: ['return', 'refund', 'exchange', 'policy']
        },
        {
          title: 'Order Tracking',
          content: 'Order track karne ke liye "track" likhein ya apna order ID bhejein.',
          category: 'faq',
          tags: ['track', 'tracking', 'order status']
        },
        {
          title: 'How to Place Order',
          content: 'Order place karne ke liye: 1) Product ka naam batao 2) Size aur color choose karo 3) Address provide karo 4) Payment method select karo.',
          category: 'faq',
          tags: ['order', 'buy', 'purchase', 'place']
        }
      ],
      restaurant: [
        {
          title: 'Menu Information',
          content: 'Hamara full menu website pe available hai. Aap hamare WhatsApp pe bhi menu request kar sakte hain.',
          category: 'faq',
          tags: ['menu', 'food', 'items', 'dish']
        },
        {
          title: 'Reservation',
          content: 'Table reserve karne ke liye apna name, date, time, aur number of guests batao. Hum aapki reservation confirm kar denge.',
          category: 'faq',
          tags: ['reservation', 'book', 'table', 'booking']
        },
        {
          title: 'Delivery Service',
          content: 'Hum home delivery bhi karte hain. Delivery charges location ke hisab se hain. Minimum order PKR 500.',
          category: 'faq',
          tags: ['delivery', 'home', 'delivery charges']
        },
        {
          title: 'Special Offers',
          content: 'Current offers aur deals ke liye hamare latest broadcasts check karein. Discount codes available hain.',
          category: 'faq',
          tags: ['offers', 'deals', 'discount', 'promo']
        },
        {
          title: 'Dietary Information',
          content: 'Vegetarian, vegan, ya kisi specific dietary requirement ke baare mein pooch sakte hain. Hum aapki help karenge.',
          category: 'faq',
          tags: ['vegetarian', 'vegan', 'diet', 'allergy']
        },
        {
          title: 'Opening Hours',
          content: 'Restaurants open hain: 11 AM se 11 PM daily. Last order 10:30 PM.',
          category: 'faq',
          tags: ['hours', 'open', 'close']
        }
      ],
      salon: [
        {
          title: 'Services Offered',
          content: 'Hum offer karte hain: Haircuts, Coloring, Keratin, Facials, Manicure, Pedicure, aur bridal services. Full price list ke liye poochiye.',
          category: 'faq',
          tags: ['services', 'haircut', 'facial', 'treatment', 'bridal']
        },
        {
          title: 'Booking Appointment',
          content: 'Appointment book karne ke liye apna name, service chahiye, aur preferred date/time batao.',
          category: 'faq',
          tags: ['appointment', 'booking', 'schedule']
        },
        {
          title: 'Pricing',
          content: 'Haircut: PKR 500-2000, Facial: PKR 1500-5000, Hair Coloring: PKR 3000-15000. Final price service ke hisab se hoga.',
          category: 'faq',
          tags: ['price', 'cost', 'charges']
        },
        {
          title: 'Stylist Experience',
          content: 'Humare experienced stylists hain jo international training ke sath hain. Bridal makeup artists bhi available hain.',
          category: 'faq',
          tags: ['stylist', 'artist', 'experience']
        }
      ],
      medical: [
        {
          title: 'Appointment Booking',
          content: 'Appointment ke liye apna name, contact number, aur health concern batao. Hum aapko available slots de denge.',
          category: 'faq',
          tags: ['appointment', 'booking', 'schedule', 'checkup']
        },
        {
          title: 'Consultation Fees',
          content: 'General consultation: PKR 1000-3000. Specialist fees vary karte hain. Insurance coverage ke baare mein pooch sakte hain.',
          category: 'faq',
          tags: ['fees', 'charges', 'price', 'cost']
        },
        {
          title: 'Emergency Services',
          content: 'Emergency ke liye directly hospital ya clinic contact karein. Life-threatening situations mein 1122 (Pakistan Emergency) bhi call kar sakte hain.',
          category: 'faq',
          tags: ['emergency', 'urgent', '1122']
        },
        {
          title: 'Doctor Information',
          content: 'Humare qualified doctors hain jo different specialties mein expertise rakhte hain. Specific doctor ke baare mein pooch sakte hain.',
          category: 'faq',
          tags: ['doctor', 'specialist', 'qualification']
        }
      ],
      real_estate: [
        {
          title: 'Property Listings',
          content: 'Humare paas residential aur commercial properties available hain. Aapki requirements batao, hum suitable options de denge.',
          category: 'faq',
          tags: ['property', 'house', 'apartment', 'commercial']
        },
        {
          title: 'Buying Process',
          content: 'Property kharidne ke liye: 1) Requirements share karein 2) Properties visit karein 3) Negotiation 4) Documentation complete karein.',
          category: 'faq',
          tags: ['buy', 'purchase', 'kharidna']
        },
        {
          title: 'Rental Information',
          content: 'Rent ke liye properties available hain. Monthly rent, security deposit, aur terms ke baare mein pooch sakte hain.',
          category: 'faq',
          tags: ['rent', 'rental', 'lease']
        },
        {
          title: 'Viewing Schedule',
          content: 'Property dekhne ke liye appointment book karein. Available timings aur location share karenge.',
          category: 'faq',
          tags: ['viewing', 'visit', 'schedule']
        }
      ],
      automotive: [
        {
          title: 'Vehicle Inventory',
          content: 'Hum naye aur used cars available hain. Brand, model, aur budget batao, hum options de denge.',
          category: 'faq',
          tags: ['car', 'vehicle', 'inventory', 'available']
        },
        {
          title: 'Test Drive',
          content: 'Test drive ke liye appointment karein. Valid driving license required hai.',
          category: 'faq',
          tags: ['test drive', 'trial', 'drive']
        },
        {
          title: 'Financing Options',
          content: 'Bank financing aur leasing options available hain. Down payment aur monthly installments ke baare mein discuss kar sakte hain.',
          category: 'faq',
          tags: ['finance', 'loan', 'installment', 'bank']
        },
        {
          title: 'Service & Maintenance',
          content: 'Hum authorized service center bhi hain. Regular maintenance aur repairs karte hain. Appointment required hai.',
          category: 'faq',
          tags: ['service', 'maintenance', 'repair']
        }
      ],
      education: [
        {
          title: 'Available Courses',
          content: 'Hum different courses offer karte hain. Aapki interest area batao, hum relevant courses de denge.',
          category: 'faq',
          tags: ['course', 'class', 'training', 'program']
        },
        {
          title: 'Admission Process',
          content: 'Admission ke liye apna educational background aur interest share karein. Registration form fill karna hoga.',
          category: 'faq',
          tags: ['admission', 'register', 'enroll']
        },
        {
          title: 'Fee Structure',
          content: 'Course fees vary karte hain. Duration aur intensity ke hisab se prices hain. Scholarship options ke baare mein bhi pooch sakte hain.',
          category: 'faq',
          tags: ['fee', 'charges', 'cost', 'scholarship']
        },
        {
          title: 'Class Schedule',
          content: 'Classes morning aur evening batches mein hain. Weekday aur weekend options available hain.',
          category: 'faq',
          tags: ['schedule', 'timing', 'batch', 'class time']
        }
      ],
      travel: [
        {
          title: 'Tour Packages',
          content: 'Hum domestic aur international tour packages offer karte hain. Budget aur destination batao, hum packages de denge.',
          category: 'faq',
          tags: ['tour', 'package', 'trip', 'vacation']
        },
        {
          title: 'Booking Process',
          content: 'Booking ke liye travel dates, number of travelers, aur preferences share karein.',
          category: 'faq',
          tags: ['booking', 'reserve', 'plan']
        },
        {
          title: 'Visa Assistance',
          content: 'Hum visa processing assistance bhi dete hain. Required documents aur fees ke baare mein pooch sakte hain.',
          category: 'faq',
          tags: ['visa', 'passport', 'documentation']
        },
        {
          title: 'Flight Bookings',
          content: 'Domestic aur international flights book kar sakte hain. Best fares ke liye contact karein.',
          category: 'faq',
          tags: ['flight', 'airline', 'booking']
        }
      ],
      other: [
        {
          title: 'Our Services',
          content: 'Hum various services offer karte hain. Aapki requirements batao aur hum aapki madad karenge.',
          category: 'faq',
          tags: ['service', 'help', 'support']
        },
        {
          title: 'How Can We Help',
          content: 'Aapko kya chahiye? Apna question ya requirement clearly batao aur hum aapki best possible help karenge.',
          category: 'faq',
          tags: ['help', 'question', 'inquiry']
        }
      ]
    };

    return knowledgeByType[businessType] || knowledgeByType.other;
  }

  // Policy knowledge for all businesses
  getPolicyKnowledge() {
    return [
      {
        title: 'Privacy Policy',
        content: 'Aapki personal information humari privacy ko respect karti hai. Data sirf service delivery ke liye use hota hai.',
        category: 'policy',
        tags: ['privacy', 'data', 'security']
      },
      {
        title: 'Terms of Service',
        content: 'Service use karna means aap humari terms se agree karte hain. Fair usage policy apply hoti hai.',
        category: 'policy',
        tags: ['terms', 'conditions', 'agreement']
      }
    ];
  }

  // Seed knowledge base for a business based on type
  async seedKnowledgeBase(businessId, businessType = 'other') {
    try {
      const existingCount = await KnowledgeBase.countDocuments({ business: businessId });
      if (existingCount > 0) {
        console.log(`Knowledge base already has ${existingCount} entries for business ${businessId}`);
        return { success: false, message: 'Knowledge base already seeded' };
      }

      const allData = [
        ...this.getUniversalFAQs(),
        ...this.getTypeSpecificKnowledge(businessType),
        ...this.getPolicyKnowledge()
      ];

      const knowledgeEntries = allData.map(item => ({
        ...item,
        business: businessId,
        isActive: true
      }));

      const result = await KnowledgeBase.insertMany(knowledgeEntries);
      
      console.log(`Seeded ${result.length} knowledge base entries for business ${businessId} (type: ${businessType})`);
      
      return { 
        success: true, 
        count: result.length,
        message: `Successfully added ${result.length} knowledge entries`
      };
    } catch (error) {
      console.error('Error seeding knowledge base:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async seedKnowledgeBaseLegacy(businessId) {
    return this.seedKnowledgeBase(businessId, 'ecommerce');
  }

  // Add single entry
  async addEntry(businessId, data) {
    return await KnowledgeBase.create({
      ...data,
      business: businessId,
      isActive: true
    });
  }

  // Get all entries for a business
  async getAllEntries(businessId, category = null) {
    const query = { business: businessId, isActive: true };
    if (category) {
      query.category = category;
    }
    return await KnowledgeBase.find(query).sort({ category: 1, title: 1 });
  }

  // Search entries
  async searchEntries(businessId, searchQuery) {
    return await KnowledgeBase.find({
      business: businessId,
      isActive: true,
      $or: [
        { title: { $regex: searchQuery, $options: 'i' } },
        { content: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } }
      ]
    }).limit(10);
  }
}

module.exports = new KnowledgeBaseService();
