/**
 * Button Builder untuk @muhammadseptian10227-cmyk/bails
 * Support semua jenis button: Quick Reply, URL, Copy, Call, List, Product, Poll, Native Flow
 */

class ButtonBuilder {
  /**
   * Create quick reply buttons
   */
  static createQuickReplyButtons(buttons) {
    return buttons.map((btn, index) => ({
      buttonId: btn.id || `btn_${Date.now()}_${index}`,
      buttonText: { displayText: btn.text },
      type: 1
    }));
  }

  /**
   * Create interactive buttons (WhatsApp Business support)
   */
  static createInteractiveButtons(buttons) {
    return buttons.map(btn => {
      switch (btn.type) {
        case 'url':
          return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              url: btn.url
            })
          };
        case 'copy':
          return {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              copy_code: btn.copyCode || btn.text,
              id: btn.id || `copy_${Date.now()}`
            })
          };
        case 'call':
          return {
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              phone_number: btn.phoneNumber
            })
          };
        case 'location':
          return {
            name: 'send_location',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text || 'Share Location'
            })
          };
        case 'address':
          return {
            name: 'address_message',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text || 'Send Address',
              address: btn.address || ''
            })
          };
        case 'quick_reply':
        default:
          return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              id: btn.id || `qr_${Date.now()}`
            })
          };
      }
    });
  }

  /**
   * Create button message dengan berbagai tipe
   */
  static createButtonMessage(content, buttons, options = {}) {
    const baseButtons = this.createQuickReplyButtons(buttons);
    
    let message = {
      text: content,
      footer: options.footer || '',
      buttons: baseButtons,
      headerType: options.headerType || 1,
      viewOnce: options.viewOnce || false
    };

    // Add media
    if (options.image) {
      message = {
        image: options.image,
        caption: content,
        footer: options.footer || '',
        buttons: baseButtons,
        headerType: 4,
        viewOnce: options.viewOnce || false
      };
    } else if (options.video) {
      message = {
        video: options.video,
        caption: content,
        footer: options.footer || '',
        buttons: baseButtons,
        headerType: 4,
        viewOnce: options.viewOnce || false
      };
    } else if (options.document) {
      message = {
        document: options.document,
        mimetype: options.mimetype || 'application/pdf',
        fileName: options.fileName || 'document.pdf',
        caption: content,
        footer: options.footer || '',
        buttons: baseButtons,
        headerType: 4,
        viewOnce: options.viewOnce || false
      };
    }

    return message;
  }

  /**
   * Create interactive message dengan AI icon
   */
  static createInteractiveMessage(options = {}) {
    const {
      text,
      title,
      footer,
      buttons = [],
      image,
      video,
      document,
      ai = false,
      externalAdReply
    } = options;

    const interactiveButtons = this.createInteractiveButtons(buttons);
    
    let message = {
      text: text || '',
      title: title || '',
      footer: footer || '',
      interactiveButtons,
      ai // Support AI icon
    };

    // Add media
    if (image) {
      message.image = image;
      message.caption = text || '';
    } else if (video) {
      message.video = video;
      message.caption = text || '';
    } else if (document) {
      message.document = document;
      message.mimetype = options.mimetype || 'application/pdf';
      message.fileName = options.fileName || 'document.pdf';
      message.caption = text || '';
    }

    // External Ad Reply
    if (externalAdReply) {
      message.contextInfo = {
        externalAdReply: {
          title: externalAdReply.title || '',
          body: externalAdReply.body || '',
          mediaType: externalAdReply.mediaType || 1,
          thumbnailUrl: externalAdReply.thumbnailUrl,
          sourceUrl: externalAdReply.sourceUrl,
          showAdAttribution: externalAdReply.showAdAttribution !== false
        }
      };
    }

    return message;
  }

  /**
   * Create list message (single select)
   */
  static createListMessage(title, description, footer, buttonText, sections) {
    return {
      list: {
        title: title,
        description: description,
        buttonText: buttonText,
        footerText: footer,
        sections: sections.map(section => ({
          title: section.title,
          rows: section.rows.map(row => ({
            title: row.title,
            description: row.description,
            rowId: row.id || `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
          }))
        }))
      }
    };
  }

  /**
   * Create poll message
   */
  static createPollMessage(question, options, selectableCount = 1) {
    return {
      poll: {
        name: question,
        values: options.map(opt => ({ optionName: opt })),
        selectableCount: selectableCount
      }
    };
  }

  /**
   * Create product message
   */
  static createProductMessage(product, buttons = []) {
    const {
      title,
      description,
      thumbnail,
      productId,
      retailerId,
      url,
      priceAmount,
      currencyCode = 'IDR'
    } = product;

    const productButtons = buttons.map(btn => ({
      name: btn.type || 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: btn.text,
        url: btn.url,
        ...btn.params
      })
    }));

    return {
      productMessage: {
        product: {
          productId: productId || `prod_${Date.now()}`,
          title: title,
          description: description,
          currencyCode: currencyCode,
          priceAmount1000: priceAmount * 1000,
          retailerId: retailerId || 'bails_store',
          url: url,
          productImageCount: 1,
          firstImageId: thumbnail ? Buffer.from(thumbnail).toString('base64') : undefined
        },
        businessOwnerJid: product.businessOwnerJid || '',
        buttons: productButtons
      }
    };
  }

  /**
   * Create album message (multiple images/videos)
   */
  static createAlbumMessage(mediaItems, caption = '') {
    return {
      album: mediaItems.map(item => ({
        image: item.image ? { url: item.image } : undefined,
        video: item.video ? { url: item.video } : undefined,
        caption: item.caption || caption
      }))
    };
  }

  /**
   * Create native flow message (advanced interactive)
   */
  static createNativeFlowMessage(options = {}) {
    const {
      header,
      title,
      footer,
      image,
      buttons = [],
      messageParams = {}
    } = options;

    return {
      interactiveMessage: {
        header: {
          title: header,
          hasMediaAttachment: !!image
        },
        body: {
          text: title
        },
        footer: {
          text: footer
        },
        nativeFlowMessage: {
          buttons: buttons.map(btn => ({
            name: btn.name || 'single_select',
            buttonParamsJson: JSON.stringify(btn.params || {})
          })),
          messageParamsJson: JSON.stringify(messageParams)
        }
      }
    };
  }

  /**
   * Create template buttons
   */
  static createTemplateButtons(buttons) {
    return {
      templateButtons: buttons.map((btn, index) => {
        if (btn.url) {
          return {
            index: btn.index || index,
            urlButton: {
              displayText: btn.text,
              url: btn.url
            }
          };
        } else if (btn.call) {
          return {
            index: btn.index || index,
            callButton: {
              displayText: btn.text,
              phoneNumber: btn.call
            }
          };
        } else {
          return {
            index: btn.index || index,
            quickReplyButton: {
              displayText: btn.text,
              id: btn.id || `qr_${Date.now()}_${index}`
            }
          };
        }
      })
    };
  }

  /**
   * Create catalog message
   */
  static createCatalogMessage(catalog, buttons = []) {
    return {
      catalogMessage: {
        title: catalog.title,
        description: catalog.description,
        thumbnailImage: catalog.thumbnail,
        productSetId: catalog.setId || `set_${Date.now()}`,
        productItems: catalog.items.map(item => ({
          productId: item.id,
          title: item.title,
          description: item.description,
          currencyCode: item.currency || 'IDR',
          priceAmount1000: item.price * 1000,
          image: item.image
        })),
        buttons: buttons.map(btn => ({
          name: btn.type || 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: btn.text,
            id: btn.id
          })
        }))
      }
    };
  }
}

module.exports = ButtonBuilder;
