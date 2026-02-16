/**
 * @muhammadseptian10227-cmyk/bails - Enhanced WhatsApp API
 * GitHub: github:muhammadseptian10227-cmyk/bails
 * Fitur: Support All Button, Custom Pairing, Anti Delay, Fast Respon, Anti Disconnect
 */

const { default: makeWASocket } = require('./src/socket');
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  Browsers,
  jidNormalizedUser,
  downloadContentFromMessage,
  getContentType,
  proto
} = require('@whiskeysockets/baileys');

// Utils
const ConnectionHandler = require('./src/utils/connection-handler');
const MessageHandler = require('./src/utils/message-handler');
const CacheManager = require('./src/utils/cache-manager');
const ButtonBuilder = require('./src/lib/button-builder');

// Re-export untuk kemudahan penggunaan
module.exports = {
  // Core Baileys
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  Browsers,
  jidNormalizedUser,
  downloadContentFromMessage,
  getContentType,
  proto,
  
  // Enhanced Components
  ConnectionHandler,
  MessageHandler,
  CacheManager,
  ButtonBuilder,
  
  // Utility functions untuk button
  createButtonMessage: ButtonBuilder.createButtonMessage,
  createInteractiveMessage: ButtonBuilder.createInteractiveMessage,
  createListMessage: ButtonBuilder.createListMessage,
  createPollMessage: ButtonBuilder.createPollMessage,
  createProductMessage: ButtonBuilder.createProductMessage,
  createAlbumMessage: ButtonBuilder.createAlbumMessage,
  createNativeFlowMessage: ButtonBuilder.createNativeFlowMessage,
  createTemplateButtons: ButtonBuilder.createTemplateButtons,
  
  // Helper untuk pairing
  requestCustomPairingCode: async (sock, phoneNumber, customCode) => {
    if (!sock?.authState?.creds?.registered) {
      return await sock.requestPairingCode(phoneNumber, customCode);
    }
    return null;
  },
  
  // Helper untuk connection
  getConnectionStatus: (sock) => {
    return {
      connected: !!sock?.user,
      user: sock?.user,
      wsReady: sock?.ws?.readyState === 1
    };
  }
};

// Version info
module.exports.version = '2.7.0';
module.exports.author = 'muhammadseptian10227-cmyk';
module.exports.repository = 'github:muhammadseptian10227-cmyk/bails';
