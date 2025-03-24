'use strict';

const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

class EmailPollerService {
  constructor(strapi) {
    console.log('[EmailPoller] Initializing simple email test service at:', new Date().toISOString());
    this.strapi = strapi;
    
    try {
      // Define IMAP configuration
      this.config = {
        imap: {
          user: process.env.SMTP_USERNAME,
          password: process.env.SMTP_PASSWORD,
          host: process.env.IMAP_HOST || process.env.SMTP_HOST || 'imap.gmail.com',
          port: parseInt(process.env.IMAP_PORT || '993', 10),
          tls: true,
          tlsOptions: { 
            rejectUnauthorized: false,  // This can be needed for some Gmail accounts
            servername: process.env.IMAP_HOST || 'imap.gmail.com'
          },
          authTimeout: 60000,  // Increased timeout
          connTimeout: 60000,  // Increased timeout
          socketTimeout: 90000 // Increased timeout
        }
      };

      // Flag to track connection status
      this.isConnected = false;
      this.lastConnectionAttempt = null;
      this.connectionErrors = [];
      this.maxConnectionErrors = 5;
      
      console.log('[EmailPoller] IMAP configuration prepared successfully');
    } catch (error) {
      console.error('[EmailPoller] Failed to initialize IMAP config:', error);
      throw error;
    }
  }

  async start() {
    console.log('[EmailPoller] Starting simplified email test service at:', new Date().toISOString());
    
    // Run test connection asynchronously to avoid blocking Strapi startup
    setTimeout(() => {
      console.log('[EmailPoller] Running test connection to check emails...');
      this.testConnection()
        .then(result => {
          console.log('[EmailPoller] Test connection completed with result:', 
            result.success ? 
              `Success - Found ${result.messageCount} total emails, ${result.unreadMessageCount} unread` : 
              `Failed - ${result.error}`);
        })
        .catch(error => {
          console.error('[EmailPoller] Test connection failed:', error);
        });
    }, 15000); // Run test connection after Strapi has had time to start
    
    return Promise.resolve();
  }

  async stop() {
    console.log('[EmailPoller] Stopping simplified email test service');
    return Promise.resolve();
  }

  /**
   * Test connection and get all unread emails from the last 24 hours
   * Simple diagnostic method to check inbox contents
   */
  async testConnection() {
    console.log('[EmailPoller] Starting test connection at:', new Date().toISOString());
    console.log('[EmailPoller] Using IMAP configuration:', {
      host: this.config.imap.host,
      port: this.config.imap.port,
      user: this.config.imap.user,
      tls: this.config.imap.tls,
    });
    
    let connection = null;
    
    try {
      // Create a new connection
      console.log('[EmailPoller] Connecting to IMAP server...');
      connection = await imaps.connect(this.config);
      console.log('[EmailPoller] Connection established successfully');
      
      // Open the inbox
      await connection.openBox('INBOX');
      console.log('[EmailPoller] INBOX opened successfully');
      
      // Get unread emails from last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      console.log('[EmailPoller] Searching for unread emails from last 24 hours...');
      const messages = await connection.search(['UNSEEN', ['SINCE', yesterday]], {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false
      });
      
      console.log(`[EmailPoller] Found ${messages.length} unread emails from last 24 hours`);
      
      // Process each message
      for (let i = 0; i < 1; i++) {
        const message = messages[i];
        
        try {
          console.log(`\n[EmailPoller] ----- EMAIL ${i+1}/${messages.length} -----`);
          console.log(`[EmailPoller] Message UID: ${JSON.stringify(message) || 'unknown'}, Sequence #: ${JSON.stringify(message.seqno) || 'unknown'}`);
          
          // Get message parts
          const parts = imaps.getParts(message.parts);
          
          // Extract full message
          const fullPart = parts.find(part => part.which === '') || 
                         parts.find(part => part.which === 'TEXT') ||
                         parts[0];
          
          if (fullPart) {
            // Parse the email
            const parsed = await simpleParser(fullPart.body);
            
            // Log email details
            console.log(`[EmailPoller] FROM: ${this.getEmailAddress(parsed.from)}`);
            console.log(`[EmailPoller] TO: ${this.getEmailAddress(parsed.to)}`);
            console.log(`[EmailPoller] SUBJECT: ${parsed.subject || '(no subject)'}`);
            console.log(`[EmailPoller] DATE: ${parsed.date?.toISOString() || 'Unknown date'}`);
            
            // Log email body
            const bodyText = parsed.text || parsed.textAsHtml || '(no content)';
            console.log(`[EmailPoller] BODY PREVIEW: \n${bodyText.substring(0, 500)}${bodyText.length > 500 ? '...' : ''}`);
          } else {
            console.log('[EmailPoller] No message body found');
          }
          
          console.log('[EmailPoller] ------------------------------');
        } catch (messageError) {
          console.error(`[EmailPoller] Error processing message ${i+1}:`, messageError);
        }
      }
      
      // Close the connection
      await connection.end();
      console.log('[EmailPoller] Connection closed successfully');
      
      return {
        success: true,
        messageCount: messages.length,
        unreadMessageCount: messages.length
      };
    } catch (error) {
      console.error('[EmailPoller] Test connection failed:', error);
      console.error('[EmailPoller] Error details:', {
        message: error.message, 
        type: error.type,
        source: error.source,
        code: error.code
      });
      
      // Attempt to close the connection if it exists
      if (connection) {
        try {
          await connection.end();
        } catch (closeError) {
          console.error('[EmailPoller] Error closing connection:', closeError);
        }
      }
      
      return {
        success: false,
        error: error.message,
        errorDetails: {
          type: error.type,
          source: error.source,
          code: error.code
        }
      };
    }
  }

  /**
   * Helper method to safely extract email address from AddressObject
   * @param {Object} addressObj - Address object from parsed email
   * @return {string} - Email address or placeholder
   */
  getEmailAddress(addressObj) {
    try {
      if (!addressObj) return '(unknown)';
      
      // Handle different address formats
      if (typeof addressObj.text === 'string') {
        return addressObj.text;
      }
      
      if (Array.isArray(addressObj.value) && addressObj.value.length > 0) {
        const firstAddress = addressObj.value[0];
        return firstAddress.address || firstAddress.name || '(unknown format)';
      }
      
      if (addressObj.value && addressObj.value.address) {
        return addressObj.value.address;
      }
      
      // Fall back to stringifying the object
      return JSON.stringify(addressObj).substring(0, 100);
    } catch (error) {
      console.error('[EmailPoller] Error extracting email address:', error);
      return '(parsing error)';
    }
  }

  /**
   * Connect to the IMAP server with retry logic
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} delay - Delay between retries in milliseconds
   * @returns {Promise<Object>} - Connection object or null
   */
  async connect(maxRetries = 3, delay = 5000) {
    this.lastConnectionAttempt = new Date();
    let retries = 0;
    let connection = null;
    
    while (retries <= maxRetries) {
      try {
        console.log(`[EmailPoller] Connecting to IMAP server (attempt ${retries + 1}/${maxRetries + 1})...`);
        connection = await imaps.connect(this.config);
        
        console.log('[EmailPoller] Connection established successfully');
        this.isConnected = true;
        
        // Reset error tracking on successful connection
        this.connectionErrors = [];
        
        return connection;
      } catch (error) {
        retries++;
        this.isConnected = false;
        
        // Store error for tracking patterns
        this.connectionErrors.push({
          timestamp: new Date(),
          message: error.message,
          code: error.code,
          type: error.type
        });
        
        // Trim error history if it gets too long
        if (this.connectionErrors.length > this.maxConnectionErrors) {
          this.connectionErrors.shift();
        }
        
        console.error(`[EmailPoller] Connection attempt ${retries}/${maxRetries + 1} failed:`, error.message);
        
        if (retries <= maxRetries) {
          console.log(`[EmailPoller] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('[EmailPoller] Max retries reached. Connection failed.');
          throw error;
        }
      }
    }
    
    return null;
  }
}

module.exports = ({ strapi }) => {
  return new EmailPollerService(strapi);
}; 