'use strict';

const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

class EmailPollerService {
  constructor(strapi) {
    console.log('[EmailPoller] Initializing email polling service at:', new Date().toISOString());
    console.log('[EmailPoller] DEBUG: Email poller constructor called - service is being instantiated');
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

      // Background process configuration
      this.backgroundConfig = {
        enabled: process.env.EMAIL_BACKGROUND_ENABLED !== 'false', // Enabled by default
        intervalMinutes: parseInt(process.env.EMAIL_CHECK_INTERVAL_MINUTES || '30', 10),
        batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '50', 10),
        markAsRead: process.env.EMAIL_MARK_AS_READ !== 'false', // Mark as read by default
        retryFailedEmails: true,
        maxRetries: 3
      };

      // Flag to track connection status
      this.isConnected = false;
      this.lastConnectionAttempt = null;
      this.connectionErrors = [];
      this.maxConnectionErrors = 5;
      
      // Background process timer reference
      this.backgroundTimer = null;
      this.lastBackgroundCheck = null;
      this.isBackgroundProcessRunning = false;
      
      console.log('[EmailPoller] IMAP configuration prepared:', {
        host: this.config.imap.host,
        port: this.config.imap.port,
        user: this.config.imap.user,
        tls: this.config.imap.tls,
        timeouts: {
          authTimeout: this.config.imap.authTimeout,
          connTimeout: this.config.imap.connTimeout,
          socketTimeout: this.config.imap.socketTimeout
        }
      });

      console.log('[EmailPoller] Background process configuration:', {
        enabled: this.backgroundConfig.enabled,
        intervalMinutes: this.backgroundConfig.intervalMinutes,
        batchSize: this.backgroundConfig.batchSize,
        markAsRead: this.backgroundConfig.markAsRead
      });

      console.log('[EmailPoller] DEBUG: Email environment variables loaded:', {
        SMTP_USERNAME: !!process.env.SMTP_USERNAME,
        SMTP_PASSWORD: !!process.env.SMTP_PASSWORD,
        IMAP_HOST: process.env.IMAP_HOST || '(using default)',
        SMTP_HOST: process.env.SMTP_HOST || '(not set)',
        IMAP_PORT: process.env.IMAP_PORT || '(using default 993)'
      });
    } catch (error) {
      console.error('[EmailPoller] Failed to initialize IMAP config:', error);
      throw error;
    }
  }

  async start() {
    console.log('[EmailPoller] Starting simplified email test service at:', new Date().toISOString());
    console.log('[EmailPoller] DEBUG: start() method called - Strapi is initializing the email poller');
    
    // Run test connection asynchronously to avoid blocking Strapi startup
    setTimeout(() => {
      console.log('[EmailPoller] Running test connection to check emails...');
      console.log('[EmailPoller] DEBUG: Initial test connection triggered via setTimeout');
      this.testConnection()
        .then(result => {
          console.log('[EmailPoller] Test connection completed with result:', 
            result.success ? 
              `Success - Found ${result.messageCount} total emails, ${result.unreadMessageCount} unread` : 
              `Failed - ${result.error}`);
          console.log('[EmailPoller] DEBUG: Initial email check complete - email poller is functioning');
          
          // Start the background process if enabled
          if (this.backgroundConfig.enabled) {
            this.startBackgroundProcess();
          }
        })
        .catch(error => {
          console.error('[EmailPoller] Test connection failed:', error);
          console.error('[EmailPoller] DEBUG: Initial email check FAILED - check email credentials and network');
          
          // Still start background process even if initial test fails
          if (this.backgroundConfig.enabled) {
            this.startBackgroundProcess();
          }
        });
    }, 15000); // Run test connection after Strapi has had time to start
    
    return Promise.resolve();
  }

  async stop() {
    console.log('[EmailPoller] Stopping simplified email test service');
    console.log('[EmailPoller] DEBUG: stop() method called - Email poller is being shut down');
    
    // Clean up background timer if running
    this.stopBackgroundProcess();
    
    return Promise.resolve();
  }

  /**
   * Test connection and get all unread emails from the last 24 hours
   * Simple diagnostic method to check inbox contents
   */
  async testConnection() {
    const startTime = Date.now();
    console.log('[EmailPoller] Starting test connection at:', new Date().toISOString());
    console.log('[EmailPoller] DEBUG: testConnection() method called directly - checking for new emails');
    console.log('[EmailPoller] DEBUG: Call stack:', new Error().stack);
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
      const connectionStartTime = Date.now();
      console.log('[EmailPoller] DEBUG: About to call imaps.connect() with config');
      connection = await imaps.connect(this.config);
      const connectionTime = Date.now() - connectionStartTime;
      console.log(`[EmailPoller] Connection established successfully in ${connectionTime}ms`);
      console.log('[EmailPoller] DEBUG: IMAP connection established successfully');
      
      // Open the inbox
      const boxOpenStartTime = Date.now();
      console.log('[EmailPoller] DEBUG: About to open INBOX mailbox');
      await connection.openBox('INBOX');
      const boxOpenTime = Date.now() - boxOpenStartTime;
      console.log(`[EmailPoller] INBOX opened successfully in ${boxOpenTime}ms`);
      
      // Get unread emails from last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      console.log('[EmailPoller] Searching for unread emails from last 24 hours:', {
        since: yesterday.toISOString(),
        searchCriteria: ['UNSEEN', ['SINCE', yesterday]]
      });
      
      const searchStartTime = Date.now();
      console.log('[EmailPoller] DEBUG: About to search for UNSEEN emails since', yesterday.toISOString());
      const messages = await connection.search(['UNSEEN', ['SINCE', yesterday]], {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false
      });
      const searchTime = Date.now() - searchStartTime;
      
      console.log(`[EmailPoller] Search completed in ${searchTime}ms. Found ${messages.length} unread emails from last 24 hours`);
      console.log('[EmailPoller] DEBUG: IMAP search successful, processing found messages');
      
      // Process each message
      for (let i = 0; i < Math.min(messages.length, 5); i++) {  // Process up to 5 emails for logging
        const message = messages[i];
        
        try {
          console.log(`\n[EmailPoller] ----- EMAIL ${i+1}/${messages.length} -----`);
          console.log(`[EmailPoller] DEBUG: Processing email ${i+1}/${messages.length}`);
          console.log(`[EmailPoller] Message details:`, {
            uid: message.attributes?.uid || 'unknown',
            seqno: message.seqno || 'unknown',
            receivedDate: message.attributes?.date ? new Date(message.attributes.date).toISOString() : 'unknown',
            size: message.attributes?.size || 'unknown',
            flags: message.attributes?.flags || []
          });
          
          // Get message parts using custom function instead of imaps.getParts
          console.log("[EmailPoller] Raw message parts:", message.parts);
          // const parts = imaps.getParts(message.parts);
          const parts = this.getMessageParts(message.parts);
          console.log(`[EmailPoller] Message has ${parts.length} parts with types:`, 
            parts.map(part => part.which || 'unknown'));
          
          // Continue only if we have parts
          if (parts.length === 0) {
            console.log('[EmailPoller] No usable parts found in message, trying direct body extraction');
            
            // Try to extract body directly from message if parts extraction failed
            let bodyContent = null;
            
            // Look for text part in the raw message parts
            if (message.parts && Array.isArray(message.parts)) {
              const textPart = message.parts.find(p => p.which === 'TEXT');
              const fullPart = message.parts.find(p => p.which === '');
              
              if (textPart && textPart.body) {
                console.log('[EmailPoller] Found TEXT part directly in message.parts');
                bodyContent = textPart.body;
              } else if (fullPart && fullPart.body) {
                console.log('[EmailPoller] Found full message part directly in message.parts');
                bodyContent = fullPart.body;
              }
              
              if (bodyContent) {
                console.log('[EmailPoller] Extracted body content directly from message.parts');
                const parsingStartTime = Date.now();
                const parsed = await simpleParser(bodyContent);
                const parsingTime = Date.now() - parsingStartTime;
                
                // Log email details
                console.log(`[EmailPoller] Email parsed directly in ${parsingTime}ms. Details:`, {
                  from: this.getEmailAddress(parsed.from),
                  to: this.getEmailAddress(parsed.to),
                  subject: parsed.subject || '(no subject)',
                  date: parsed.date?.toISOString() || 'Unknown date',
                  hasHtml: !!parsed.html,
                  hasText: !!parsed.text
                });
                
                // Extract and process content similar to the regular flow
                this.processEmailContent(parsed);
                
                // Continue to next message
                continue;
              }
            }
            
            console.log('[EmailPoller] No usable content found in message');
            continue;
          }
          
          // Extract full message for parsing (normal flow)
          const fullPart = parts.find(part => part.which === '') || 
                         parts.find(part => part.which === 'TEXT') ||
                         parts[0];
          
          if (fullPart) {
            const parsingStartTime = Date.now();
            
            // Parse the email
            const parsed = await simpleParser(fullPart.body);
            const parsingTime = Date.now() - parsingStartTime;
            
            // Log email details
            console.log(`[EmailPoller] Email parsed in ${parsingTime}ms. Details:`, {
              from: this.getEmailAddress(parsed.from),
              to: this.getEmailAddress(parsed.to),
              subject: parsed.subject || '(no subject)',
              date: parsed.date?.toISOString() || 'Unknown date',
              hasAttachments: parsed.attachments?.length > 0,
              size: fullPart.body.length,
              messageId: parsed.messageId,
              inReplyTo: parsed.inReplyTo,
              references: parsed.references,
              hasHtml: !!parsed.html,
              hasText: !!parsed.text
            });
            
            // Extract and log message content
            let bodyText = '';
            
            // Get text content (prefer plain text over HTML)
            if (parsed.text) {
              bodyText = parsed.text;
              console.log(`[EmailPoller] Found plain text content (${bodyText.length} chars)`);
            } else if (parsed.html) {
              bodyText = parsed.html.replace(/<[^>]*>/g, ' '); // Simple HTML tag stripping
              console.log(`[EmailPoller] Converted HTML content to text (${bodyText.length} chars)`);
            } else if (parsed.textAsHtml) {
              bodyText = parsed.textAsHtml.replace(/<[^>]*>/g, ' '); // Simple HTML tag stripping
              console.log(`[EmailPoller] Converted textAsHtml to text (${bodyText.length} chars)`);
            }
            
            // If multipart and we have content-type info
            if (parsed.headers.has('content-type') && 
                parsed.headers.get('content-type').toString().includes('multipart/alternative')) {
              console.log('[EmailPoller] Message is multipart/alternative');
              
              // Log information about available properties and headers on the parsed email
              console.log('[EmailPoller] Parsed email has the following parts/content:', {
                hasText: !!parsed.text, 
                hasHtml: !!parsed.html,
                hasAttachments: !!parsed.attachments && parsed.attachments.length > 0,
                attachmentCount: parsed.attachments?.length || 0,
                headerKeys: Array.from(parsed.headers.keys())
              });
              
              // Log available headers
              console.log('[EmailPoller] Content-Type:', 
                parsed.headers.get('content-type')?.toString() || 'not available');
            }
            
            // Clean up the body text - first attempt to extract only the reply portion
            const cleanBody = this.extractReplyContent(bodyText);
            console.log(`[EmailPoller] Clean body text (${cleanBody.length} chars): \n${cleanBody.substring(0, 500)}${cleanBody.length > 500 ? '...' : ''}`);
            
            // Also show full preview to check cleaning
            console.log(`[EmailPoller] Raw BODY PREVIEW (${bodyText.length} chars): \n${bodyText.substring(0, 500)}${bodyText.length > 500 ? '...' : ''}`);
            
            // Check if this is a restaurant reply
            const isReply = this.isRestaurantReply(parsed);
            console.log(`[EmailPoller] Is restaurant reply: ${isReply}`);
            
            // Try to extract chat ID from the message
            const chatId = this.extractChatId(parsed);
            console.log(`[EmailPoller] Extracted chat ID: ${chatId || 'None found'}`);
            
            if (isReply) {
              const processingStartTime = Date.now();
              
              // Process restaurant reply
              this.processRestaurantReply(parsed)
                .then(result => {
                  const processingTime = Date.now() - processingStartTime;
                  console.log(`[EmailPoller] Restaurant reply processing completed in ${processingTime}ms:`, result);
                })
                .catch(error => {
                  console.error('[EmailPoller] Error processing restaurant reply:', error);
                });
            }
          } else {
            console.log('[EmailPoller] No message body found');
          }
          
          console.log('[EmailPoller] ------------------------------');
        } catch (messageError) {
          console.error(`[EmailPoller] Error processing message ${i+1}:`, messageError);
        }
      }
      
      // Close the connection
      console.log('[EmailPoller] Closing IMAP connection...');
      await connection.end();
      console.log('[EmailPoller] Connection closed successfully');
      
      const totalTime = Date.now() - startTime;
      console.log(`[EmailPoller] Test connection completed in ${totalTime}ms`);
      
      return {
        success: true,
        messageCount: messages.length,
        unreadMessageCount: messages.length,
        processingTimeMs: totalTime
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[EmailPoller] Test connection failed after ${totalTime}ms:`, {
        error: error.message,
        type: error.type,
        source: error.source,
        code: error.code,
        stack: error.stack
      });
      
      // Attempt to close the connection if it exists
      if (connection) {
        try {
          await connection.end();
          console.log('[EmailPoller] Connection closed after error');
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
        },
        processingTimeMs: totalTime
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

  isRestaurantReply(email) {
    console.log('[EmailPoller] DEBUG: isRestaurantReply() called to check if email is from restaurant');
    // Check if email is from a restaurant domain
    const fromEmail = this.getEmailAddress(email.from);
    const isFromRestaurant = fromEmail.includes('@restaurant.') ||
           fromEmail.includes('@resto.') ||
           fromEmail.includes('@dining.');
    
    console.log(`[EmailPoller] DEBUG: Email from ${fromEmail} is ${isFromRestaurant ? 'identified as' : 'NOT'} a restaurant email`);
    return true;
  }

  extractChatId(email) {
    console.log('[EmailPoller] DEBUG: extractChatId() called to find chat ID in email');
    let chatId = null;
    let extractionMethod = 'none';
    
    // Check subject first
    if (email.subject) {
      console.log(`[EmailPoller] DEBUG: Checking subject: "${email.subject}"`);
      const subjectMatch = email.subject.match(/\[ChatID:\s*(\d+)\]/i);
      if (subjectMatch && subjectMatch[1]) {
        chatId = subjectMatch[1];
        extractionMethod = 'subject';
        console.log(`[EmailPoller] Found chat ID in subject: ${chatId}`);
        console.log(`[EmailPoller] DEBUG: Successfully extracted chat ID ${chatId} from subject`);
        return chatId;
      } else {
        console.log('[EmailPoller] DEBUG: No chat ID found in subject');
      }
    } else {
      console.log('[EmailPoller] DEBUG: Email has no subject to check');
    }
    
    // Check email text body
    if (email.text) {
      console.log('[EmailPoller] DEBUG: Checking email text body for chat ID');
      // Look for Reference: format as seen in the example
      const refMatch = email.text.match(/Reference:\s*(\d+)/i);
      if (refMatch && refMatch[1]) {
        chatId = refMatch[1];
        extractionMethod = 'text_reference';
        console.log(`[EmailPoller] Found chat ID in body text (Reference format): ${chatId}`);
        console.log(`[EmailPoller] DEBUG: Successfully extracted chat ID ${chatId} from body text using Reference format`);
        return chatId;
      } else {
        console.log('[EmailPoller] DEBUG: No "Reference: XX" format found in body text');
      }
      
      // Alternative: Look for Chat ID: format
      const chatIdMatch = email.text.match(/Chat ID:\s*(\d+)/i);
      if (chatIdMatch && chatIdMatch[1]) {
        chatId = chatIdMatch[1];
        extractionMethod = 'text_chatid';
        console.log(`[EmailPoller] Found chat ID in body text (Chat ID format): ${chatId}`);
        console.log(`[EmailPoller] DEBUG: Successfully extracted chat ID ${chatId} from body text using Chat ID format`);
        return chatId;
      } else {
        console.log('[EmailPoller] DEBUG: No "Chat ID: XX" format found in body text');
      }
    } else {
      console.log('[EmailPoller] DEBUG: Email has no text body to check');
    }
    
    // Check HTML body if available
    if (email.html) {
      console.log('[EmailPoller] DEBUG: Checking HTML body for chat ID');
      // Look for Reference in HTML
      const htmlRefMatch = email.html.match(/Reference:\s*(\d+)/i);
      if (htmlRefMatch && htmlRefMatch[1]) {
        chatId = htmlRefMatch[1];
        extractionMethod = 'html_reference';
        console.log(`[EmailPoller] Found chat ID in HTML body (Reference format): ${chatId}`);
        console.log(`[EmailPoller] DEBUG: Successfully extracted chat ID ${chatId} from HTML body`);
        return chatId;
      } else {
        console.log('[EmailPoller] DEBUG: No "Reference: XX" format found in HTML body');
      }
    } else {
      console.log('[EmailPoller] DEBUG: Email has no HTML body to check');
    }
    
    // Check headers for X-Chat-ID
    if (email.headers && email.headers.get('x-chat-id')) {
      console.log('[EmailPoller] DEBUG: Checking X-Chat-ID header');
      chatId = email.headers.get('x-chat-id').toString();
      extractionMethod = 'header';
      console.log(`[EmailPoller] Found chat ID in X-Chat-ID header: ${chatId}`);
      console.log(`[EmailPoller] DEBUG: Successfully extracted chat ID ${chatId} from X-Chat-ID header`);
      return chatId;
    } else {
      console.log('[EmailPoller] DEBUG: No X-Chat-ID header present or it\'s empty');
    }
    
    console.log('[EmailPoller] DEBUG: Failed to extract chat ID from email using any method');
    return null;
  }

  parseReplyContent(email) {
    console.log('[EmailPoller] Parsing reply content...');
    console.log('[EmailPoller] DEBUG: parseReplyContent() called to extract reply content');
    
    // Extract just the reply content, stripping quoted text
    let body = email.text || '';
    console.log(`[EmailPoller] Original body length: ${body.length} chars`);
    
    if (!body) {
      console.log('[EmailPoller] DEBUG: No text body found in email, returning empty string');
      return '';
    }
    
    // Split into lines to better handle reply content
    const lines = body.split('\n');
    let content = [];
    let quotedContentStarted = false;
    
    console.log(`[EmailPoller] DEBUG: Processing ${lines.length} lines of text to extract reply content`);
    
    // Process each line
    for (const line of lines) {
      // Look for markers indicating start of quoted content
      if (line.startsWith('>') || 
          line.match(/^On .+wrote:$/i) ||
          line.includes('allerpal5@gmail.com') && line.includes('wrote:')) {
        quotedContentStarted = true;
        console.log(`[EmailPoller] Found quoted content marker: ${line.substring(0, 50)}${line.length > 50 ? '...' : ''}`);
        console.log('[EmailPoller] DEBUG: Detected quoted content marker, stopping collection');
        break; // Stop collecting content once quoted section starts
      }
      
      // Collect lines until we hit quoted content
      if (!quotedContentStarted) {
      content.push(line);
      }
    }
    
    // Join the lines back together
    const cleanedContent = content.join('\n').trim();
    console.log(`[EmailPoller] Extracted reply content: ${cleanedContent.length} chars`);
    console.log(`[EmailPoller] DEBUG: Extracted ${content.length} lines of reply content, final length: ${cleanedContent.length} chars`);
    
    return cleanedContent;
  }

  extractReplyContent(bodyText) {
    console.log('[EmailPoller] DEBUG: extractReplyContent() called with body text');
    
    if (!bodyText) {
      console.log('[EmailPoller] DEBUG: No body text provided, returning empty string');
      return '';
    }
    
    const lines = bodyText.split('\n');
    console.log(`[EmailPoller] DEBUG: Processing ${lines.length} lines to extract reply content`);
    
    let content = [];
    let quotedContentStarted = false;
    let quotedContentMarkerFound = false;
    
    // Process each line
    for (const line of lines) {
      // Look for markers indicating start of quoted content
      if (line.startsWith('>') || 
          line.match(/^On .+wrote:$/i) ||
          line.includes('allerpal5@gmail.com') && line.includes('wrote:')) {
        quotedContentStarted = true;
        quotedContentMarkerFound = true;
        console.log(`[EmailPoller] DEBUG: Found quoted content marker: "${line.substring(0, 30)}..."`);
        break; // Stop collecting content once quoted section starts
      }
      
      // Collect lines until we hit quoted content
      if (!quotedContentStarted) {
        content.push(line);
      }
    }
    
    if (!quotedContentMarkerFound) {
      console.log('[EmailPoller] DEBUG: No quoted content markers found in the email');
    }
    
    const result = content.join('\n').trim();
    console.log(`[EmailPoller] DEBUG: Extracted ${content.length}/${lines.length} lines as reply content`);
    
    return result;
  }

  async processRestaurantReply(email, messageUID = null) {
    const startTime = Date.now();
    console.log('[EmailPoller] Processing restaurant reply:', {
      messageId: email.messageId,
      uid: messageUID || 'unknown',
      from: this.getEmailAddress(email.from),
      subject: email.subject,
      date: email.date || new Date()
    });
    console.log('[EmailPoller] DEBUG: processRestaurantReply() called for message:', email.messageId);
    console.log('[EmailPoller] DEBUG: Call tracking:', {
      source: new Error().stack.split('\n')[2] || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    try {
      // Extract email metadata
      const metadata = {
        messageId: email.messageId,
        uid: messageUID,
        inReplyTo: email.inReplyTo,
        references: email.references,
        from: this.getEmailAddress(email.from),
        date: email.date || new Date()
      };

      console.log('[EmailPoller] Email metadata:', metadata);
      console.log('[EmailPoller] DEBUG: Email metadata extracted');

      // Try multiple methods to find the chat ID
      let chatId = this.extractChatId(email);
      let chatIdSource = 'direct_extraction';
      console.log(`[EmailPoller] DEBUG: Initial chat ID extraction ${chatId ? 'SUCCESSFUL' : 'FAILED'}`);
      
      if (!chatId) {
        console.log('[EmailPoller] Direct chat ID extraction failed, trying reference headers...');
        console.log('[EmailPoller] DEBUG: Attempting fallback methods to find chat ID');
        
        // Try to find chat by reference headers
        if (metadata.references) {
          console.log(`[EmailPoller] Searching for chat with messageId in references: ${metadata.references}`);
          console.log('[EmailPoller] DEBUG: Searching database for chat using references header');
          
          try {
            const chat = await this.strapi.db.query('api::chat.chat').findOne({
              where: {
                'emailMetadata.messageId': metadata.references
              },
              populate: ['restaurant']
            });
            
            if (chat) {
              chatId = chat.id;
              chatIdSource = 'references_header';
              console.log(`[EmailPoller] Found chat ${chatId} using references header`);
              console.log('[EmailPoller] DEBUG: Successfully found chat using references header');
            } else {
              console.log('[EmailPoller] No chat found using references header');
              console.log('[EmailPoller] DEBUG: Database query returned no results for references header');
            }
          } catch (dbError) {
            console.error('[EmailPoller] Error querying database for references:', dbError);
            console.error('[EmailPoller] DEBUG: Database query FAILED for references header');
          }
        } else {
          console.log('[EmailPoller] DEBUG: No references header available to search');
        }
        
        // If still not found, try matching by restaurant email
        if (!chatId && metadata.from) {
          console.log(`[EmailPoller] Searching for chat with restaurant email: ${metadata.from}`);
          console.log('[EmailPoller] DEBUG: Attempting final fallback - search by restaurant email');
          
          try {
            const chat = await this.strapi.db.query('api::chat.chat').findOne({
              where: {
                'restaurant.email': metadata.from,
                status: ['active', 'pending_restaurant']
              },
              orderBy: { lastMessageTime: 'desc' },
              populate: ['restaurant']
            });
            
            if (chat) {
              chatId = chat.id;
              chatIdSource = 'restaurant_email';
              console.log(`[EmailPoller] Found chat ${chatId} using restaurant email`);
              console.log('[EmailPoller] DEBUG: Successfully found chat using restaurant email');
            } else {
              console.log('[EmailPoller] No chat found using restaurant email');
              console.log('[EmailPoller] DEBUG: Database query returned no results for restaurant email');
            }
          } catch (dbError) {
            console.error('[EmailPoller] Error querying database for restaurant email:', dbError);
            console.error('[EmailPoller] DEBUG: Database query FAILED for restaurant email');
          }
        } else if (chatId) {
          console.log('[EmailPoller] DEBUG: Chat already found, skipping restaurant email search');
        } else {
          console.log('[EmailPoller] DEBUG: No from email available to search');
        }
      } else {
        console.log(`[EmailPoller] Found chat ID ${chatId} directly from email content`);
      }

      if (!chatId) {
        console.log('[EmailPoller] No chat ID found in restaurant reply, message will be ignored');
        return {
          success: false,
          reason: 'no_chat_id_found',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Get chat details for logging
      console.log(`[EmailPoller] Fetching chat details for chat ID ${chatId}`);
      console.log('[EmailPoller] DEBUG: Querying database for chat details');
      try {
        const chatDetails = await this.strapi.db.query('api::chat.chat').findOne({
          where: { id: chatId },
          populate: ['restaurant', 'user']
        });
        
        if (!chatDetails) {
          console.log(`[EmailPoller] Chat with ID ${chatId} not found in database`);
          console.log('[EmailPoller] DEBUG: Database query returned no chat for ID');
          return {
            success: false,
            reason: 'chat_not_found',
            chatId,
            processingTimeMs: Date.now() - startTime
          };
        }
        
        console.log(`[EmailPoller] Found chat:`, {
          id: chatDetails.id,
          status: chatDetails.status,
          restaurant: chatDetails.restaurant?.name || 'Unknown',
          user: chatDetails.user?.username || 'Unknown',
          lastMessageTime: chatDetails.lastMessageTime
        });
        console.log(`[EmailPoller] DEBUG: Chat details retrieved successfully`);
      } catch (chatDbError) {
        console.error('[EmailPoller] Error fetching chat details:', chatDbError);
        console.error('[EmailPoller] DEBUG: Database query FAILED for chat details');
        return {
          success: false,
          reason: 'chat_details_error',
          error: chatDbError.message,
          chatId,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Use the enhanced content extraction
      let content = '';
      console.log('[EmailPoller] DEBUG: Attempting to extract reply content');
      
      // First try to use parseReplyContent for backward compatibility
      content = this.parseReplyContent(email);
      
      // If that yields no content, try the raw text directly
      if (!content && email.text) {
        console.log('[EmailPoller] DEBUG: First extraction method failed, trying extractReplyContent');
        content = this.extractReplyContent(email.text);
        console.log(`[EmailPoller] Extracted content using extractReplyContent: ${content.length} chars`);
      }
      
      // Final fallback to raw email text if we still have nothing
      if (!content && email.text) {
        console.log('[EmailPoller] No content extracted, using first 3 lines of raw text as fallback');
        console.log('[EmailPoller] DEBUG: All extraction methods failed, using first 3 lines as fallback');
        const lines = email.text.split('\n').slice(0, 3);
        content = lines.join('\n').trim();
      }
      
      console.log(`[EmailPoller] Final parsed content (${content.length} chars):`, {
        preview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      });
      
      if (!content) {
        console.log('[EmailPoller] No valid content found in restaurant reply');
        console.log('[EmailPoller] DEBUG: Failed to extract any usable content from email');
        return {
          success: false,
          reason: 'no_content',
          chatId,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Store email metadata with the chat
      console.log(`[EmailPoller] Updating chat ${chatId} with email metadata`);
      console.log('[EmailPoller] DEBUG: Updating chat with email metadata via chat service');
      try {
        // Log available services
        console.log('[EmailPoller] DEBUG: Available services:', {
          chatService: !!this.strapi.service('api::chat.chat'),
          chatServiceType: typeof this.strapi.service('api::chat.chat'),
          chatServiceMethods: Object.keys(this.strapi.service('api::chat.chat') || {})
        });

        // Try to get the chat service
        const chatService = this.strapi.service('api::chat.chat');
        if (!chatService) {
          throw new Error('Chat service not found');
        }

        // Log chat service methods
        console.log('[EmailPoller] DEBUG: Chat service methods:', {
          hasUpdate: typeof chatService.update === 'function',
          hasProcessResponse: typeof chatService.processRestaurantResponse === 'function',
          methods: Object.keys(chatService)
        });

        // Try to update using entityService instead if update is not available
        if (typeof chatService.update !== 'function') {
          console.log('[EmailPoller] DEBUG: Using entityService.update as fallback');
          await this.strapi.entityService.update('api::chat.chat', chatId, {
            data: {
              emailMetadata: {
                ...metadata,
                lastProcessedAt: new Date()
              }
            }
          });
        } else {
          await chatService.update(chatId, {
            data: {
              emailMetadata: {
                ...metadata,
                lastProcessedAt: new Date()
              }
            }
          });
        }

        console.log(`[EmailPoller] Chat ${chatId} metadata updated successfully`);
        console.log('[EmailPoller] DEBUG: Chat metadata update successful');
      } catch (updateError) {
        console.error('[EmailPoller] Error updating chat metadata:', updateError);
        console.error('[EmailPoller] DEBUG: Chat metadata update FAILED');
        console.error('[EmailPoller] DEBUG: Error details:', {
          name: updateError.name,
          message: updateError.message,
          stack: updateError.stack,
          code: updateError.code
        });
        // Continue processing even if metadata update fails
      }

      // Process the restaurant response
      console.log(`[EmailPoller] Processing restaurant response for chat ${chatId}`);
      console.log('[EmailPoller] DEBUG: Calling processRestaurantResponse on chat service');
      try {
        // Get chat service and verify it exists
        const chatService = this.strapi.service('api::chat.chat');
        if (!chatService) {
          throw new Error('Chat service not found for processing response');
        }

        // Log chat details before processing
        const chatDetails = await this.strapi.entityService.findOne('api::chat.chat', chatId, {
          populate: ['restaurant', 'user']
        });
        console.log('[EmailPoller] DEBUG: Chat details before processing:', {
          chatId,
          hasRestaurant: !!chatDetails?.restaurant,
          hasUser: !!chatDetails?.user,
          status: chatDetails?.status
        });

        // Verify processRestaurantResponse exists
        if (typeof chatService.processRestaurantResponse !== 'function') {
          throw new Error('processRestaurantResponse method not found on chat service');
        }

        const processResult = await chatService.processRestaurantResponse(
        chatId,
        content,
          metadata.date
        );

        console.log(`[EmailPoller] Restaurant response processed for chat ${chatId}:`, processResult);
        console.log('[EmailPoller] DEBUG: Chat service processed restaurant response successfully');
        
        const totalTime = Date.now() - startTime;
        console.log(`[EmailPoller] Successfully processed restaurant reply for chat ${chatId} in ${totalTime}ms`);
        
        return {
          success: true,
          chatId,
          chatIdSource,
          contentLength: content.length,
          processResult,
          processingTimeMs: totalTime
        };
      } catch (processError) {
        console.error('[EmailPoller] Error processing restaurant response:', processError);
        console.error('[EmailPoller] DEBUG: Chat service FAILED to process restaurant response');
        console.error('[EmailPoller] DEBUG: Error details:', {
          name: processError.name,
          message: processError.message,
          stack: processError.stack,
          code: processError.code
        });
        
        const totalTime = Date.now() - startTime;
        return {
          success: false,
          reason: 'processing_error',
          error: processError.message,
          chatId,
          processingTimeMs: totalTime
        };
      }
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[EmailPoller] Error processing restaurant reply (after ${totalTime}ms):`, {
        error: error.message,
        stack: error.stack
      });
      console.error('[EmailPoller] DEBUG: Unhandled exception in processRestaurantReply');
      
      return {
        success: false,
        reason: 'processing_error',
        error: error.message,
        processingTimeMs: totalTime
      };
    }
  }

  // Add a custom function to extract parts directly
  /**
   * Custom function to extract parts from message parts directly
   * @param {Array} messageParts - The message parts array from IMAP
   * @return {Array} - Processed parts ready for use
   */
  getMessageParts(messageParts) {
    console.log('[EmailPoller] Extracting parts using custom function');
    console.log('[EmailPoller] DEBUG: getMessageParts() called with parts array', 
      messageParts ? `(length: ${messageParts.length})` : '(null/undefined)');
    
    if (!messageParts || !Array.isArray(messageParts) || messageParts.length === 0) {
      console.log('[EmailPoller] No parts found in message');
      console.log('[EmailPoller] DEBUG: Message parts are invalid or empty');
      return [];
    }
    
    // Process each part to ensure it's usable
    const processedParts = messageParts.map(part => {
      // Return part as is if it has the expected structure
      if (part && typeof part === 'object' && part.which !== undefined && part.body !== undefined) {
        return part;
      }
      
      // Skip parts that don't have required properties
      if (!part || typeof part !== 'object') {
        console.log('[EmailPoller] Skipping invalid part:', part);
        console.log('[EmailPoller] DEBUG: Invalid message part found, skipping');
        return null;
      }
      
      return part;
    }).filter(Boolean); // Remove null entries
    
    console.log(`[EmailPoller] Extracted ${processedParts.length} parts with types:`, 
      processedParts.map(part => part.which || 'unknown'));
    console.log('[EmailPoller] DEBUG: Parts extraction complete');
    
    return processedParts;
  }

  // Add a new method to process email content (extracted for reusability)
  processEmailContent(parsed) {
    console.log('[EmailPoller] DEBUG: processEmailContent() called with parsed email');
    
    // Extract and log message content
    let bodyText = '';
    
    // Get text content (prefer plain text over HTML)
    if (parsed.text) {
      bodyText = parsed.text;
      console.log(`[EmailPoller] Found plain text content (${bodyText.length} chars)`);
      console.log('[EmailPoller] DEBUG: Using plain text content from email');
    } else if (parsed.html) {
      bodyText = parsed.html.replace(/<[^>]*>/g, ' '); // Simple HTML tag stripping
      console.log(`[EmailPoller] Converted HTML content to text (${bodyText.length} chars)`);
      console.log('[EmailPoller] DEBUG: Using stripped HTML content from email');
    } else if (parsed.textAsHtml) {
      bodyText = parsed.textAsHtml.replace(/<[^>]*>/g, ' '); // Simple HTML tag stripping
      console.log(`[EmailPoller] Converted textAsHtml to text (${bodyText.length} chars)`);
      console.log('[EmailPoller] DEBUG: Using stripped textAsHtml content from email');
    } else {
      console.log('[EmailPoller] DEBUG: No usable content found in email');
    }
    
    // If multipart and we have content-type info
    if (parsed.headers && parsed.headers.has('content-type') && 
        parsed.headers.get('content-type').toString().includes('multipart/alternative')) {
      console.log('[EmailPoller] Message is multipart/alternative');
      console.log('[EmailPoller] DEBUG: Email is multipart/alternative type');
      
      // Log information about available properties and headers on the parsed email
      console.log('[EmailPoller] Parsed email has the following parts/content:', {
        hasText: !!parsed.text, 
        hasHtml: !!parsed.html,
        hasAttachments: !!parsed.attachments && parsed.attachments.length > 0,
        attachmentCount: parsed.attachments?.length || 0,
        headerKeys: Array.from(parsed.headers.keys())
      });
      
      // Log available headers
      console.log('[EmailPoller] Content-Type:', 
        parsed.headers.get('content-type')?.toString() || 'not available');
    }
    
    // Clean up the body text - first attempt to extract only the reply portion
    const cleanBody = this.extractReplyContent(bodyText);
    console.log(`[EmailPoller] Clean body text (${cleanBody.length} chars): \n${cleanBody.substring(0, 500)}${cleanBody.length > 500 ? '...' : ''}`);
    if (cleanBody.length === 0 && bodyText.length > 0) {
      console.log('[EmailPoller] DEBUG: extractReplyContent returned empty result despite having body text');
    }
    
    // Also show full preview to check cleaning
    console.log(`[EmailPoller] Raw BODY PREVIEW (${bodyText.length} chars): \n${bodyText.substring(0, 500)}${bodyText.length > 500 ? '...' : ''}`);
    
    // Check if this is a restaurant reply
    const isReply = this.isRestaurantReply(parsed);
    console.log(`[EmailPoller] Is restaurant reply: ${isReply}`);
    console.log(`[EmailPoller] DEBUG: Email ${isReply ? 'IS' : 'is NOT'} identified as a restaurant reply`);
    
    // Try to extract chat ID from the message
    const chatId = this.extractChatId(parsed);
    console.log(`[EmailPoller] Extracted chat ID: ${chatId || 'None found'}`);
    console.log(`[EmailPoller] DEBUG: Chat ID extraction ${chatId ? 'SUCCESSFUL' : 'FAILED'}`);
    
    if (isReply) {
      const processingStartTime = Date.now();
      console.log('[EmailPoller] DEBUG: Will process as restaurant reply');
      
      // Process restaurant reply
      this.processRestaurantReply(parsed)
        .then(result => {
          const processingTime = Date.now() - processingStartTime;
          console.log(`[EmailPoller] Restaurant reply processing completed in ${processingTime}ms:`, result);
          console.log(`[EmailPoller] DEBUG: Restaurant reply processing finished with result:`, 
            result.success ? 'SUCCESS' : `FAILURE (${result.reason})`);
        })
        .catch(error => {
      console.error('[EmailPoller] Error processing restaurant reply:', error);
          console.error('[EmailPoller] DEBUG: Restaurant reply processing EXCEPTION:', error.message);
        });
    } else {
      console.log('[EmailPoller] DEBUG: Email not identified as restaurant reply, skipping processing');
    }
    
    return {
      isReply,
      chatId,
      bodyText,
      cleanBody
    };
  }

  // Add new methods for background processing after the stop method
  /**
   * Start the background email processing
   */
  startBackgroundProcess() {
    if (this.backgroundTimer) {
      console.log('[EmailPoller] Background process already running, skipping initialization');
      return;
    }
    
    const intervalMs = this.backgroundConfig.intervalMinutes * 60 * 1000;
    console.log(`[EmailPoller] Starting background email process to run every ${this.backgroundConfig.intervalMinutes} minutes`);
    
    // Run immediately on startup
    this.runBackgroundEmailCheck();
    
    // Then schedule recurring checks
    this.backgroundTimer = setInterval(() => {
      this.runBackgroundEmailCheck();
    }, intervalMs);
    
    console.log('[EmailPoller] Background email process scheduled successfully');
  }

  /**
   * Stop the background email processing
   */
  stopBackgroundProcess() {
    if (this.backgroundTimer) {
      console.log('[EmailPoller] Stopping background email process');
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
      console.log('[EmailPoller] Background email process stopped');
    }
  }

  /**
   * Run a single background check for new emails
   */
  async runBackgroundEmailCheck() {
    // Prevent overlapping executions
    if (this.isBackgroundProcessRunning) {
      console.log('[EmailPoller] Background process already running, skipping this execution');
      return;
    }
    
    const startTime = Date.now();
    this.isBackgroundProcessRunning = true;
    this.lastBackgroundCheck = new Date();
    
    console.log(`[EmailPoller] Starting background email check at ${this.lastBackgroundCheck.toISOString()}`);
    
    try {
      const result = await this.processUnseenEmails();
      const duration = Date.now() - startTime;
      
      console.log(`[EmailPoller] Background email check completed in ${duration}ms:`, {
        totalEmails: result.totalEmails,
        processed: result.processedCount,
        successful: result.successCount,
        failed: result.failureCount,
        markedAsRead: result.markedAsReadCount
      });
    } catch (error) {
      console.error('[EmailPoller] Background email check failed:', error);
    } finally {
      this.isBackgroundProcessRunning = false;
    }
  }

  /**
   * Fetch all unseen emails from the IMAP server
   * @returns {Promise<{connection: any, messages: any[], searchTimeMs: number}>} - Connection and messages
   */
  async fetchUnseenEmails() {
    const startTime = Date.now();
    console.log('[EmailPoller] Fetching unseen emails...');
    
    let connection = null;
    
    try {
      // Create a new connection
      console.log('[EmailPoller] Connecting to IMAP server...');
      connection = await imaps.connect(this.config);
      console.log(`[EmailPoller] Connection established in ${Date.now() - startTime}ms`);
      
      // Open the inbox
      await connection.openBox('INBOX');
      console.log(`[EmailPoller] INBOX opened in ${Date.now() - startTime}ms`);
      
      // Search for all unseen emails (no date restriction)
      console.log('[EmailPoller] Searching for all unseen emails...');
      const messages = await connection.search(['UNSEEN'], {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false  // Don't mark as seen during search
      });
      
      console.log(`[EmailPoller] Found ${messages.length} unseen emails in ${Date.now() - startTime}ms`);
      
      return { 
        connection,
        messages,
        searchTimeMs: Date.now() - startTime
      };
    } catch (error) {
      console.error(`[EmailPoller] Error fetching unseen emails: ${error.message}`);
      
      // Close connection if it was established
      if (connection) {
        try {
          await connection.end();
          console.log('[EmailPoller] Connection closed after error');
        } catch (closeError) {
          console.error('[EmailPoller] Error closing connection:', closeError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Mark an email as read
   * @param {Object} connection - IMAP connection
   * @param {string} uid - Message UID
   * @returns {Promise<boolean>} - Success status
   */
  async markEmailAsRead(connection, uid) {
    try {
      console.log(`[EmailPoller] Marking email ${uid} as read...`);
      await connection.addFlags(uid, '\\Seen');
      console.log(`[EmailPoller] Email ${uid} marked as read successfully`);
      return true;
    } catch (error) {
      console.error(`[EmailPoller] Error marking email ${uid} as read:`, error);
      return false;
    }
  }

  /**
   * Process all unseen emails
   * @returns {Promise<Object>} - Processing statistics
   */
  async processUnseenEmails() {
    const startTime = Date.now();
    console.log('[EmailPoller] Starting to process unseen emails');
    
    const results = {
      totalEmails: 0,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      markedAsReadCount: 0,
      errors: []
    };
    
    let connection = null;
    let fetchResult = null;
    
    try {
      // Fetch all unseen emails
      fetchResult = await this.fetchUnseenEmails();
      connection = fetchResult.connection;
      const messages = fetchResult.messages;
      results.totalEmails = messages.length;
      
      if (messages.length === 0) {
        console.log('[EmailPoller] No unseen emails to process');
        await connection.end();
        return results;
      }
      
      // Process each email
      const batchSize = this.backgroundConfig.batchSize;
      const messagesToProcess = messages.slice(0, batchSize);
      
      if (messages.length > batchSize) {
        console.log(`[EmailPoller] Processing first ${batchSize} of ${messages.length} emails`);
      }
      
      // Process emails in sequence to avoid overwhelming the system
      for (const message of messagesToProcess) {
        const uid = message.attributes.uid;
        const messageId = message.attributes.uid || 'unknown';
        console.log(`[EmailPoller] Processing email ${messageId}...`);
        
        try {
          results.processedCount++;
          
          // Extract full message for parsing
          const parts = this.getMessageParts(message.parts);
          const fullPart = parts.find(part => part.which === '') || 
                           parts.find(part => part.which === 'TEXT') ||
                           parts[0];
          
          if (!fullPart) {
            console.log(`[EmailPoller] No message body found for email ${messageId}, skipping`);
            results.failureCount++;
            results.errors.push({ messageId, error: 'No message body found' });
            continue;
          }
          
          // Parse the email
          const parsed = await simpleParser(fullPart.body);
          console.log(`[EmailPoller] Email ${messageId} parsed, processing as restaurant reply`);
          
          // Process the email
          const processResult = await this.processRestaurantReply(parsed, uid);
          
          if (processResult.success) {
            results.successCount++;
            
            // Mark as read if configured to do so
            if (this.backgroundConfig.markAsRead) {
              const marked = await this.markEmailAsRead(connection, uid);
              if (marked) {
                results.markedAsReadCount++;
              }
            }
          } else {
            results.failureCount++;
            results.errors.push({ 
              messageId, 
              error: processResult.reason || 'Unknown error',
              chatId: processResult.chatId
            });
          }
        } catch (messageError) {
          console.error(`[EmailPoller] Error processing email ${messageId}:`, messageError);
          results.failureCount++;
          results.errors.push({ 
            messageId, 
            error: messageError.message
          });
        }
      }
    } catch (error) {
      console.error('[EmailPoller] Error in batch processing:', error);
      results.errors.push({ error: error.message });
    } finally {
      // Close the connection if it was established
      if (connection) {
        try {
          await connection.end();
          console.log('[EmailPoller] IMAP connection closed');
        } catch (closeError) {
          console.error('[EmailPoller] Error closing IMAP connection:', closeError);
        }
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`[EmailPoller] Finished processing emails in ${totalTime}ms`);
    }
    
    return results;
  }

  // Add a manual trigger method for testing
  /**
   * Trigger a manual check for new emails
   * This can be exposed via an API endpoint for testing
   * @returns {Promise<Object>} - Processing results
   */
  async triggerManualCheck() {
    console.log('[EmailPoller] Manual email check triggered');
    
    if (this.isBackgroundProcessRunning) {
      console.log('[EmailPoller] Background process already running, cannot start manual check');
      return {
        success: false,
        error: 'Background process already running'
      };
    }
    
    try {
      const result = await this.processUnseenEmails();
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('[EmailPoller] Manual email check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ({ strapi }) => {
  return new EmailPollerService(strapi);
}; 