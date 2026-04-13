// Interactive Form Service for WhatsApp
// Creates form-like experiences using WhatsApp interactive messages

class FormService {
  
  // Create a structured order form message
  createOrderFormMessage(product) {
    let form = `📋 *ORDER FORM*\n`;
    form += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    form += `📦 *Product:* ${product.name}\n`;
    if (product.brand) form += `🏷️ *Brand:* ${product.brand}\n`;
    form += `💰 *Price:* PKR ${product.price.toLocaleString()}\n\n`;
    form += `━━━━━━━━━━━━━━━━━━━━\n`;
    form += `📝 *Please fill this form:*\n\n`;
    
    // Size options
    if (product.sizes?.length > 0) {
      form += `📏 *SIZE:*\n`;
      product.sizes.forEach((s, i) => {
        form += `   ${this.getNumberEmoji(i + 1)} ${s.size}\n`;
      });
      form += `   Reply: number ya size name\n\n`;
    }

    // Color options
    if (product.colors?.length > 0) {
      form += `🎨 *COLOR:*\n`;
      product.colors.forEach((c, i) => {
        form += `   ${this.getNumberEmoji(i + 1)} ${c.name}\n`;
      });
      form += `   Reply: number ya color name\n\n`;
    }

    form += `📦 *QUANTITY:*\n`;
    form += `   Reply: number (1-100)\n\n`;

    form += `━━━━━━━━━━━━━━━━━━━━\n`;
    form += `✏️ *Reply format:*\n\n`;
    
    if (product.sizes?.length > 0 && product.colors?.length > 0) {
      form += `Size, Color, Quantity\n`;
      form += `Example: 42, Black, 2\n\n`;
    } else if (product.sizes?.length > 0) {
      form += `Size, Quantity\n`;
      form += `Example: 42, 2\n\n`;
    } else if (product.colors?.length > 0) {
      form += `Color, Quantity\n`;
      form += `Example: Black, 2\n\n`;
    } else {
      form += `Quantity only\n`;
      form += `Example: 2\n\n`;
    }

    form += `━━━━━━━━━━━━━━━━━━━━\n`;
    form += `Or reply *menu* to see all options`;

    return form;
  }

  // Create customer info form
  createCustomerInfoForm() {
    let form = `👤 *CUSTOMER INFORMATION FORM*\n`;
    form += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    form += `📝 *Please fill your details:*\n\n`;
    form += `1️⃣ *Name:*\n   Your full name\n\n`;
    form += `2️⃣ *Phone:*\n   Your phone number\n\n`;
    form += `3️⃣ *City:*\n   Your city\n\n`;
    form += `4️⃣ *Address:*\n   Full delivery address\n\n`;
    form += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    form += `✏️ *Reply format:*\n\n`;
    form += `Name: Ahmed Ali\n`;
    form += `Phone: 03001234567\n`;
    form += `City: Lahore\n`;
    form += `Address: House 123, Street 5, Gulberg\n\n`;
    form += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    form += `Or type *quick* for quick order with just name and address`;

    return form;
  }

  // Create product selection menu
  createProductMenu(products) {
    let menu = `🛒 *PRODUCT MENU*\n`;
    menu += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    products.forEach((p, i) => {
      menu += `${this.getNumberEmoji(i + 1)} *${p.name}*\n`;
      if (p.brand) menu += `   🏷️ ${p.brand}\n`;
      menu += `   💰 PKR ${p.price.toLocaleString()}\n`;
      if (p.sizes?.length > 0) {
        menu += `   📏 Sizes: ${p.sizes.slice(0, 4).map(s => s.size).join(', ')}${p.sizes.length > 4 ? '...' : ''}\n`;
      }
      if (p.colors?.length > 0) {
        menu += `   🎨 Colors: ${p.colors.slice(0, 3).map(c => c.name).join(', ')}${p.colors.length > 3 ? '...' : ''}\n`;
      }
      menu += `\n`;
    });

    menu += `━━━━━━━━━━━━━━━━━━━━\n`;
    menu += `📝 *To order, reply:*\n`;
    menu += `Number + Size + Color + Qty\n\n`;
    menu += `Example: *1, 42, Black, 2*\n`;
    menu += `(Product 1, Size 42, Color Black, Qty 2)`;

    return menu;
  }

  // Create quick order form (simplified)
  createQuickOrderForm(product) {
    let form = `⚡ *QUICK ORDER*\n`;
    form += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    form += `📦 *${product.name}*\n`;
    if (product.brand) form += `🏷️ ${product.brand}\n`;
    form += `💰 PKR ${product.price.toLocaleString()}\n\n`;
    form += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Build size options inline
    if (product.sizes?.length > 0) {
      const sizeOptions = product.sizes.slice(0, 6).map(s => s.size).join(', ');
      form += `📏 Size: [${sizeOptions}]\n`;
    }
    
    // Build color options inline
    if (product.colors?.length > 0) {
      const colorOptions = product.colors.slice(0, 5).map(c => c.name).join(', ');
      form += `🎨 Color: [${colorOptions}]\n`;
    }
    
    form += `📦 Qty: [number]\n\n`;
    form += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    form += `✏️ *Reply with:*\n`;
    
    if (product.sizes?.length > 0 && product.colors?.length > 0) {
      form += `[Size] [Color] [Quantity]\n\n`;
      form += `Examples:\n`;
      form += `• 42 Black 2\n`;
      form += `• 43, White, 1\n`;
    } else if (product.sizes?.length > 0) {
      form += `[Size] [Quantity]\n\n`;
      form += `Examples:\n`;
      form += `• 42 2\n`;
      form += `• 43, 1`;
    } else {
      form += `[Quantity]\n\n`;
      form += `Example: 2`;
    }

    return form;
  }

  // Create customer details form
  createCustomerDetailsForm() {
    let form = `📋 *DELIVERY DETAILS*\n`;
    form += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    form += `Please reply with your details:\n\n`;
    form += `👤 *Name:* Your full name\n`;
    form += `📍 *Address:* Complete address with city\n\n`;
    form += `━━━━━━━━━━━━━━━━━━━━\n`;
    form += `✏️ *Reply format:*\n\n`;
    form += `Name: Ahmed Ali\n`;
    form += `Address: House 123, Street 5, Gulberg, Lahore`;

    return form;
  }

  // Create order confirmation with summary
  createOrderConfirmation(product, size, color, quantity, customerInfo) {
    const total = product.price * quantity;
    
    let msg = `✅ *ORDER CONFIRMATION*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    msg += `📦 *Product Details:*\n`;
    msg += `   • Product: ${product.name}\n`;
    if (product.brand) msg += `   • Brand: ${product.brand}\n`;
    if (size) msg += `   • Size: ${size}\n`;
    if (color) msg += `   • Color: ${color}\n`;
    msg += `   • Quantity: ${quantity}\n`;
    msg += `   • Price: PKR ${product.price.toLocaleString()} x ${quantity}\n\n`;

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Total: PKR ${total.toLocaleString()}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (customerInfo) {
      msg += `📍 *Delivery Details:*\n`;
      if (customerInfo.name) msg += `   • Name: ${customerInfo.name}\n`;
      if (customerInfo.phone) msg += `   • Phone: ${customerInfo.phone}\n`;
      if (customerInfo.address) msg += `   • Address: ${customerInfo.address}\n`;
      msg += `\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `✅ *Confirm karein order place karne ke liye*\n\n`;
    msg += `Reply: *YES* to confirm\n`;
    msg += `Reply: *NO* to cancel`;

    return msg;
  }

  // Create success message
  createOrderSuccessMessage(orderId) {
    const printableId = String(orderId || '');
    let msg = `🎉 *ORDER PLACED SUCCESSFULLY!*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `Thank you for your order! 🙏\n\n`;
    msg += `📦 *Order ID: #${printableId.slice(-8).toUpperCase()}*\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📞 *What's next?*\n\n`;
    msg += `1️⃣ We'll verify your order\n`;
    msg += `2️⃣ Our team will contact you\n`;
    msg += `3️⃣ Delivery within 2-3 days\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📱 *Order track karne ke liye:*\n`;
    msg += `Reply: *track* or *order status*\n\n`;
    msg += `Thank you for shopping with us! 🛍️`;

    return msg;
  }

  // Helper: Get emoji for number
  getNumberEmoji(num) {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[num - 1] || `${num}.`;
  }

  // Parse form response (simple format: "value1, value2, value3")
  parseFormResponse(response, fields) {
    const parts = response.split(/[,\n]+/).map(p => p.trim());
    const result = {};
    
    fields.forEach((field, index) => {
      if (parts[index]) {
        // Remove field labels if present (e.g., "Name: John" -> "John")
        let value = parts[index];
        const labelMatch = value.match(/^(?:name|size|color|qty|quantity|address|phone|city):\s*/i);
        if (labelMatch) {
          value = value.substring(labelMatch[0].length).trim();
        }
        result[field] = value;
      }
    });

    return result;
  }

  // Parse key-value format (e.g., "Name: John\nAddress: 123 Main St")
  parseKeyValueResponse(response) {
    const result = {};
    const lines = response.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/i);
      if (match) {
        const key = match[1].trim().toLowerCase();
        const value = match[2].trim();
        
        if (key.includes('name') || key.includes('naam')) {
          result.name = value;
        } else if (key.includes('phone') || key.includes('mobile') || key.includes('number')) {
          result.phone = value;
        } else if (key.includes('address') || key.includes('pata')) {
          result.address = value;
        } else if (key.includes('city') || key.includes('shehar')) {
          result.city = value;
        }
      }
    }

    return result;
  }

  // Create error message for invalid input
  createErrorMessage(field, validOptions) {
    let msg = `❌ Invalid ${field}!\n\n`;
    msg += `Valid options:\n`;
    validOptions.forEach(opt => {
      msg += `• ${opt}\n`;
    });
    msg += `\nPlease try again.`;
    return msg;
  }

  // Create typing indicator (using a placeholder)
  createTypingIndicator() {
    return `⏳ Please wait...`;
  }
}

module.exports = new FormService();