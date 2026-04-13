// WhatsApp Interactive Messages Service
// Creates buttons, lists, and interactive form-like experiences

class InteractiveMessageService {
  
  // Create reply buttons message (max 3 buttons)
  createReplyButtonsMessage(headerText, bodyText, footerText, buttons) {
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: headerText
        },
        body: {
          text: bodyText
        },
        footer: {
          text: footerText
        },
        action: {
          // WhatsApp requires reply.title (max 20 chars). Do NOT use substring(20) — that drops
          // the whole string when length < 20 and sends an empty title.
          buttons: buttons.slice(0, 3).map((btn, i) => {
            const rawTitle = String(btn.title != null ? btn.title : `Option ${i + 1}`);
            const title = rawTitle.length > 20 ? rawTitle.slice(0, 20) : rawTitle;
            const id = String(btn.id != null ? btn.id : `option_${i}`);
            return {
              type: 'reply',
              reply: {
                id: id.length > 256 ? id.slice(0, 256) : id,
                title
              }
            };
          })
        }
      }
    };
  };

  // Create list message (dropdown with sections)
  createListMessage(headerText, bodyText, footerText, buttonText, sections) {
    return {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: headerText
        },
        body: {
          text: bodyText
        },
        footer: {
          text: footerText
        },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    };
  };

  // Create product selection list
  createProductListMessage(products) {
    const sections = [{
      title: "📦 Available Products",
      rows: products.map((p, i) => ({
        id: `product_${p._id}`,
        title: String(p.name || 'Product').slice(0, 24),
        description: `PKR ${p.price.toLocaleString()}${p.brand ? ` • ${p.brand}` : ''}`
      }))
    }];

    return this.createListMessage(
      '🛍️ Product Catalog',
      'Kya order karna chahte hain? Product select karein:',
      `${products.length} products available`,
      'Select Product',
      sections
    );
  };

  // Create size selection buttons
  createSizeButtonsMessage(productName, sizes) {
    const buttons = sizes.slice(0, 3).map((s, i) => ({
      id: `size_${s.size}`,
      title: `Size ${s.size}`
    }));

    // If more than 3 sizes, add "More" button
    if (sizes.length > 3) {
      buttons.push({
        id: 'size_more',
        title: 'More Sizes'
      });
    }

    return this.createReplyButtonsMessage(
      '📏 Select Size',
      `Product: *${productName}*\n\nKya size chahiye?`,
      'Size select karein',
      buttons
    );
  };

  // Create color selection buttons
  createColorButtonsMessage(productName, colors) {
    const buttons = colors.slice(0, 3).map((c, i) => ({
      id: `color_${c.name.toLowerCase()}`,
      title: c.name
    }));

    return this.createReplyButtonsMessage(
      '🎨 Select Color',
      `Product: *${productName}*\n\nKya color chahiye?`,
      'Color select karein',
      buttons
    );
  };

  // Create quantity selection buttons
  createQuantityButtonsMessage() {
    return this.createReplyButtonsMessage(
      '📦 Select Quantity',
      'Kitni pieces chahiye?',
      'Quantity select karein',
      [
        { id: 'qty_1', title: '1 Piece' },
        { id: 'qty_2', title: '2 Pieces' },
        { id: 'qty_3', title: '3 Pieces' }
      ]
    );
  };

  // Create confirmation buttons
  createConfirmationButtonsMessage(orderSummary) {
    return this.createReplyButtonsMessage(
      '✅ Confirm Order',
      orderSummary,
      'Order confirm karein ya cancel karein',
      [
        { id: 'confirm_yes', title: '✅ Confirm' },
        { id: 'confirm_no', title: '❌ Cancel' },
        { id: 'confirm_edit', title: '✏️ Edit' }
      ]
    );
  };

  // Create customer info collection message
  createCustomerInfoMessage() {
    return this.createReplyButtonsMessage(
      '👤 Your Information',
      'Apni details type karein:\n\n*Name:* Your name\n*Phone:* 03001234567\n*Address:* Full address\n\nExample:\nName: Ahmed Ali\nPhone: 03001234567\nAddress: House 123, Lahore',
      'Apni details share karein',
      [
        { id: 'info_whatsapp', title: 'Same as WhatsApp' },
        { id: 'info_new', title: 'Enter Details' }
      ]
    );
  };

  // Create success buttons
  createSuccessButtonsMessage(orderId) {
    const oid = String(orderId || '');
    return this.createReplyButtonsMessage(
      '🎉 Order Placed!',
      `Order ID: *#${oid.slice(-8).toUpperCase()}*\n\nThank you for your order!`,
      'Thank you for shopping!',
      [
        { id: 'track_order', title: '📍 Track Order' },
        { id: 'more_products', title: '🛍️ More Products' },
        { id: 'new_order', title: '🛒 New Order' }
      ]
    );
  };

  // Create quick actions menu
  createQuickActionsMenu() {
    return this.createReplyButtonsMessage(
      '👋 Welcome!',
      'Hum aapki kaise madad karein?',
      'Choose an option below',
      [
        { id: 'action_products', title: '🛍️ View Products' },
        { id: 'action_order', title: '📦 Place Order' },
        { id: 'action_support', title: '💬 Support' }
      ]
    );
  };

  // Create custom quick actions menu from business config
  createCustomQuickActionsMenu(quickActions, businessName) {
    if (!quickActions || quickActions.length === 0) {
      return this.createQuickActionsMenu();
    }

    const buttons = quickActions.slice(0, 3).map(action => ({
      id: `quick_${action.id}`,
      title: action.title.slice(0, 20)
    }));

    return this.createReplyButtonsMessage(
      `👋 ${businessName}`,
      'Kya aapko chahiye? Select karein:',
      'Choose an option',
      buttons
    );
  };

  // Parse button reply from webhook
  parseButtonReply(interactivePayload) {
    if (interactivePayload?.type !== 'button_reply') {
      return null;
    }

    const replyId = interactivePayload.button_reply.id;
    const replyTitle = interactivePayload.button_reply.title;

    // Always keep raw WhatsApp id string so handlers can use startsWith('qty_') etc.
    // (Parsed `value` may be a number, e.g. quantity 3, which breaks String methods.)
    // Parse different button types
    if (replyId.startsWith('size_')) {
      return { type: 'size', id: replyId, value: replyId.replace('size_', '') };
    }
    if (replyId.startsWith('color_')) {
      return { type: 'color', id: replyId, value: replyId.replace('color_', '') };
    }
    if (replyId.startsWith('qty_')) {
      return {
        type: 'quantity',
        id: replyId,
        value: parseInt(replyId.replace('qty_', ''), 10)
      };
    }
    if (replyId.startsWith('product_')) {
      return { type: 'product', id: replyId, value: replyId.replace('product_', '') };
    }
    if (replyId.startsWith('confirm_')) {
      return { type: 'confirm', id: replyId, value: replyId.replace('confirm_', '') };
    }
    if (replyId.startsWith('action_')) {
      return { type: 'action', id: replyId, value: replyId.replace('action_', '') };
    }
    if (replyId.startsWith('info_')) {
      return { type: 'info', id: replyId, value: replyId.replace('info_', '') };
    }

    return { type: 'unknown', id: replyId, value: replyId, title: replyTitle };
  };

  // Parse list reply from webhook
  parseListReply(interactivePayload) {
    if (interactivePayload?.type !== 'list_reply') {
      return null;
    }

    const replyId = interactivePayload.list_reply.id;
    const replyTitle = interactivePayload.list_reply.title;
    const replyDescription = interactivePayload.list_reply.description;

    if (replyId.startsWith('product_')) {
      return { 
        type: 'product', 
        productId: replyId.replace('product_', ''),
        productName: replyTitle,
        description: replyDescription
      };
    }

    return { type: 'unknown', value: replyId, title: replyTitle };
  };

  // Get button ID from reply
  getButtonId(interactivePayload) {
    if (interactivePayload?.button_reply?.id) {
      return interactivePayload.button_reply.id;
    }
    if (interactivePayload?.list_reply?.id) {
      return interactivePayload.list_reply.id;
    }
    return null;
  };
}

module.exports = new InteractiveMessageService();