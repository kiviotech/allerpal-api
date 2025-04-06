'use strict';

/**
 * Email handler service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::email-handler.email-handler', ({ strapi }) => ({
  /**
   * Process an incoming email
   * @param {Object} emailData - Email data from webhook
   * @returns {Promise<Object>} - Processing result
   */
  async processIncomingEmail(emailData) {
    try {
      const { from, subject, text, headers } = emailData;
      
      // Enhanced logging
      strapi.log.info('[EmailHandler] Processing incoming email:', {
        from,
        subject,
        hasText: !!text,
        headers: Object.keys(headers || {}),
        timestamp: new Date().toISOString()
      });
      
      // Extract chat ID from headers or subject
      let chatId = null;
      let extractionMethod = null;
      
      // Try to extract from custom header
      if (headers && headers['X-Chat-ID']) {
        chatId = headers['X-Chat-ID'];
        extractionMethod = 'header';
      }
      
      // If not found, try to extract from subject
      if (!chatId && subject) {
        // Look for Reference: CHAT_ID in the subject
        const refMatch = subject.match(/Reference:\s*([a-zA-Z0-9]+)/i);
        if (refMatch && refMatch[1]) {
          chatId = refMatch[1];
          extractionMethod = 'subject';
        }
      }
      
      // If still not found, try to extract from email body
      if (!chatId && text) {
        const refMatch = text.match(/Reference:\s*([a-zA-Z0-9]+)/i);
        if (refMatch && refMatch[1]) {
          chatId = refMatch[1];
          extractionMethod = 'body';
        }
      }
      
      if (!chatId) {
        strapi.log.warn('[EmailHandler] Could not identify chat ID from email', {
          from,
          subject,
          timestamp: new Date().toISOString()
        });
        return { success: false, error: 'Could not identify chat ID from email' };
      }

      strapi.log.info(`[EmailHandler] Found chat ID ${chatId} using ${extractionMethod}`);
      
      // Find the chat with retries
      let chat = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!chat && retryCount < maxRetries) {
        try {
          chat = await strapi.db.query('api::chat.chat').findOne({
            where: { id: chatId },
            populate: ['user', 'restaurant'],
          });
          
          if (!chat) {
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        } catch (error) {
          strapi.log.error(`[EmailHandler] Error finding chat (attempt ${retryCount + 1}):`, error);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      if (!chat) {
        strapi.log.error(`[EmailHandler] Chat with ID ${chatId} not found after ${maxRetries} attempts`);
        return { success: false, error: `Chat with ID ${chatId} not found` };
      }
      
      // Extract email content with better handling
      let emailContent = text;
      
      try {
        // Remove email signatures and quoted replies
        emailContent = emailContent
          .split(/^On .* wrote:$/m)[0] // Remove quoted replies
          .split(/^--$/m)[0] // Remove signatures
          .trim();
          
        if (!emailContent) {
          strapi.log.warn('[EmailHandler] Empty content after cleaning', { chatId });
          return { success: false, error: 'Empty message content' };
        }
      } catch (error) {
        strapi.log.error('[EmailHandler] Error cleaning email content:', error);
        emailContent = text.trim(); // Fallback to original text
      }
      
      // Create message with retry
      let message = null;
      retryCount = 0;
      
      while (!message && retryCount < maxRetries) {
        try {
          message = await strapi.service('api::message.message').create({
            data: {
              text: emailContent,
              sender: 'restaurant',
              timestamp: new Date().toISOString(),
              read: false,
              chat: chat.id
            }
          });
        } catch (error) {
          strapi.log.error(`[EmailHandler] Error creating message (attempt ${retryCount + 1}):`, error);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      if (!message) {
        strapi.log.error('[EmailHandler] Failed to create message after retries');
        return { success: false, error: 'Failed to create message' };
      }
      
      // Update chat status with retry
      retryCount = 0;
      let updatedChat = null;
      
      while (!updatedChat && retryCount < maxRetries) {
        try {
          updatedChat = await strapi.service('api::chat.chat').update(chat.id, {
            data: {
              lastMessage: emailContent,
              lastMessageTime: new Date().toISOString(),
              status: 'responded',
              unreadCount: (chat.unreadCount || 0) + 1
            }
          });
        } catch (error) {
          strapi.log.error(`[EmailHandler] Error updating chat (attempt ${retryCount + 1}):`, error);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      if (!updatedChat) {
        strapi.log.error('[EmailHandler] Failed to update chat after retries');
        return { success: false, error: 'Failed to update chat status' };
      }
      
      // Log success
      strapi.log.info('[EmailHandler] Successfully processed email', {
        chatId,
        messageId: message.id,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        chatId: chat.id,
        message: 'Email processed successfully',
        messageId: message.id
      };
    } catch (error) {
      strapi.log.error('[EmailHandler] Unhandled error processing email:', error);
      return { success: false, error: error.message };
    }
  }
})); 