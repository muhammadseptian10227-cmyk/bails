/**
 * Socket Baileys yang dimodifikasi - @muhammadseptian10227-cmyk/bails
 * Fitur: Anti delay, Fast respon, Anti disconnect, Custom pairing
 */

const {
  default: makeWASocketOriginal,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const pino = require('pino');
const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');

// Cache untuk group metadata (mengurangi delay)
const groupCache = new NodeCache({
  stdTTL: 5 * 60, // 5 menit
  useClones: false,
  checkperiod: 60
});

// Cache untuk pesan (fast respon)
const messageCache = new NodeCache({
  stdTTL: 60, // 1 menit
  useClones: false,
  maxKeys: 1000
});

// Logger dengan level error saja untuk performa
const logger = pino({ level: 'error' });

class EnhancedWASocket extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.sock = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 50;
    this.reconnectInterval = config.reconnectInterval || 3000;
    this.keepAliveInterval = null;
    this.pingInterval = null;
    this.authFolder = config.authFolder || 'bails-session';
    this.sessionId = config.sessionId || `bails_${Date.now()}`;
  }

  async connect() {
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`📱 @muhammadseptian10227-cmyk/bails using WA v${version.join('.')}, isLatest: ${isLatest}`);

      // Pastikan folder auth ada
      await fs.ensureDir(this.authFolder);

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

      // Konfigurasi socket dengan optimasi performa
      const sock = makeWASocketOriginal({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: this.config.printQRInTerminal || false,
        browser: this.config.browser || Browsers.ubuntu('BAILS-BOT'),
        
        // Optimasi untuk anti delay
        markOnlineOnConnect: this.config.markOnlineOnConnect || false,
        
        // Cache group metadata
        cachedGroupMetadata: async (jid) => {
          const cached = groupCache.get(jid);
          if (cached) return cached;
          
          try {
            const metadata = await sock.groupMetadata(jid);
            groupCache.set(jid, metadata);
            return metadata;
          } catch (error) {
            return null;
          }
        },
        
        // Get message untuk retry system
        getMessage: async (key) => {
          const cached = messageCache.get(JSON.stringify(key));
          if (cached) return cached;
          
          // Coba baca dari file jika ada
          try {
            const msgPath = path.join(this.authFolder, 'messages', `${key.id}.json`);
            if (await fs.pathExists(msgPath)) {
              const msg = await fs.readJson(msgPath);
              messageCache.set(JSON.stringify(key), msg);
              return msg;
            }
          } catch (error) {}
          
          return null;
        },
        
        // Sync full history
        syncFullHistory: this.config.syncFullHistory || true,
        
        // Generate high quality link preview
        generateHighQualityLinkPreview: true,
        
        // Option tambahan untuk stabilitas
        shouldIgnoreJid: (jid) => {
          // Ignore status broadcast untuk performa
          return jid === 'status@broadcast';
        },
        
        // Default message options
        defaultQueryTimeoutMs: 10000,
        
        // Keep alive settings
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 5,
        
        // Logger
        logger: logger
      });

      // Store reference
      this.sock = sock;
      
      // Setup connection handler
      this.setupConnectionHandler(saveCreds);
      
      // Setup keep alive
      this.setupKeepAlive();
      
      // Setup ping untuk fast respon
      this.setupPingInterval();

      // Setup message saver
      this.setupMessageSaver();

      return sock;
    } catch (error) {
      console.error('Connection error:', error);
      this.handleReconnect();
    }
  }

  setupConnectionHandler(saveCreds) {
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && this.config.qrCallback) {
        this.config.qrCallback(qr);
      } else if (qr) {
        console.log('QR Code:', qr);
      }

      if (connection === 'close') {
        const shouldReconnect = this.shouldReconnect(lastDisconnect);
        
        if (shouldReconnect) {
          console.log(`🔄 [${this.sessionId}] Connection closed, reconnecting...`);
          this.handleReconnect();
        } else {
          console.log(`❌ [${this.sessionId}] Connection closed permanently`);
          this.emit('disconnected', lastDisconnect);
          this.cleanup();
        }
      } else if (connection === 'open') {
        console.log(`✅ [${this.sessionId}] Connected successfully`);
        this.reconnectAttempts = 0;
        this.emit('connected', this.sock.user);
        
        // Set online status jika diinginkan
        if (this.config.markOnlineOnConnect) {
          this.sock.sendPresenceUpdate('available');
        }
        
        // Simpan info user
        if (this.sock.user) {
          const userInfoPath = path.join(this.authFolder, 'user.json');
          await fs.writeJson(userInfoPath, this.sock.user, { spaces: 2 });
        }
      }
    });

    // Update credentials
    this.sock.ev.on('creds.update', saveCreds);
    
    // Update group cache
    this.sock.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        if (update.id) {
          groupCache.del(update.id);
          try {
            const metadata = await this.sock.groupMetadata(update.id);
            groupCache.set(update.id, metadata);
          } catch (error) {}
        }
      }
    });
    
    this.sock.ev.on('group-participants.update', async (update) => {
      if (update.id) {
        groupCache.del(update.id);
        try {
          const metadata = await this.sock.groupMetadata(update.id);
          groupCache.set(update.id, metadata);
        } catch (error) {}
      }
    });
    
    // Cache messages untuk fast respon
    this.sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (msg.key) {
          messageCache.set(JSON.stringify(msg.key), msg.message);
        }
      }
    });
    
    // Handle messages
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      this.emit('messages.upsert', { messages, type });
    });
  }

  shouldReconnect(lastDisconnect) {
    const error = lastDisconnect?.error;
    const statusCode = error instanceof Boom ? error.output.statusCode : 500;
    
    // Jangan reconnect jika logged out
    if (statusCode === DisconnectReason.loggedOut) {
      return false;
    }
    
    // Batasi jumlah reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false;
    }
    
    return true;
  }

  handleReconnect() {
    this.reconnectAttempts++;
    
    // Exponential backoff (max 30 detik)
    const delay = Math.min(
      this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000
    );
    
    console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  setupKeepAlive() {
    // Keep alive untuk mencegah disconnect
    this.keepAliveInterval = setInterval(() => {
      if (this.sock?.ws?.readyState === 1) { // WebSocket OPEN
        this.sock.ws.ping();
      }
    }, 25000); // 25 detik
  }

  setupPingInterval() {
    // Ping untuk fast respon
    this.pingInterval = setInterval(async () => {
      try {
        if (this.sock?.user) {
          // Kirim presence update untuk menjaga koneksi tetap aktif
          await this.sock.sendPresenceUpdate('available');
        }
      } catch (error) {
        // Ignore error
      }
    }, 60000); // 1 menit
  }

  setupMessageSaver() {
    // Simpan pesan penting ke file (opsional)
    const msgDir = path.join(this.authFolder, 'messages');
    fs.ensureDirSync(msgDir);
    
    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        // Simpan pesan dengan id tertentu (misalnya yang penting)
        if (msg.key?.id && msg.message?.conversation) {
          const msgPath = path.join(msgDir, `${msg.key.id}.json`);
          await fs.writeJson(msgPath, msg, { spaces: 2 }).catch(() => {});
        }
      }
    });
  }

  cleanup() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Custom pairing method
  async requestCustomPairing(phoneNumber, customCode = null) {
    if (!this.sock) {
      throw new Error('Socket not initialized');
    }
    
    if (this.sock.authState.creds.registered) {
      console.log('Already registered');
      return null;
    }
    
    // Generate random 8-char code jika tidak disediakan
    const pairingCode = customCode || this.generatePairingCode();
    
    try {
      const code = await this.sock.requestPairingCode(phoneNumber, pairingCode);
      return code;
    } catch (error) {
      console.error('Pairing error:', error);
      throw error;
    }
  }

  generatePairingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Send message dengan retry
  async sendMessageWithRetry(jid, content, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.sock.sendMessage(jid, content, {
          ...options,
          waitForAck: true,
          timeoutMs: 10000
        });
        return result;
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }
    
    throw lastError;
  }
}

// Factory function
const makeWASocket = (config = {}) => {
  const enhanced = new EnhancedWASocket(config);
  enhanced.connect();
  
  // Proxy untuk akses langsung ke socket properties
  return new Proxy(enhanced, {
    get(target, prop) {
      // Prioritaskan properti dari EnhancedWASocket
      if (prop in target) {
        return target[prop];
      }
      // Fallback ke socket asli
      if (target.sock && prop in target.sock) {
        const value = target.sock[prop];
        return typeof value === 'function' ? value.bind(target.sock) : value;
      }
      return undefined;
    }
  });
};

module.exports = {
  default: makeWASocket,
  EnhancedWASocket
};
