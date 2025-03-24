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
      
      // Extract chat ID from headers or subject
      let chatId = null;
      
      // Try to extract from custom header
      if (headers && headers['X-Chat-ID']) {
        chatId = headers['X-Chat-ID'];
      }
      
      // If not found, try to extract from subject
      if (!chatId && subject) {
        // Look for Reference: CHAT_ID in the subject
        const refMatch = subject.match(/Reference:\s*([a-zA-Z0-9]+)/i);
        if (refMatch && refMatch[1]) {
          chatId = refMatch[1];
        }
      }
      
      // If still not found, try to extract from email body
      if (!chatId && text) {
        const refMatch = text.match(/Reference:\s*([a-zA-Z0-9]+)/i);
        if (refMatch && refMatch[1]) {
          chatId = refMatch[1];
        }
      }
      
      if (!chatId) {
        return { success: false, error: 'Could not identify chat ID from email' };
      }
      
      // Find the chat
      const chat = await strapi.db.query('api::chat.chat').findOne({
        where: { id: chatId },
        populate: ['user', 'restaurant'],
      });
      
      if (!chat) {
        return { success: false, error: `Chat with ID ${chatId} not found` };
      }
      
      // Extract email content
      let emailContent = text;
      
      // Remove email signatures and quoted replies
      emailContent = emailContent
        .split(/^On .* wrote:$/m)[0] // Remove quoted replies
        .split(/^--$/m)[0] // Remove signatures
        .trim();
      
      // Add message to chat
      await strapi.service('api::message.message').create({
        data: {
          text: emailContent,
          sender: 'restaurant',
          timestamp: new Date().toISOString(),
          read: false,
          chat: chat.id
        }
      });
      
      // Update chat status
      await strapi.service('api::chat.chat').update(chat.id, {
        data: {
          lastMessage: emailContent,
          lastMessageTime: new Date().toISOString(),
          status: 'responded',
          unreadCount: (chat.unreadCount || 0) + 1
        }
      });
      
      return {
        success: true,
        chatId: chat.id,
        message: 'Email processed successfully'
      };
    } catch (error) {
      strapi.log.error('Error processing incoming email:', error);
      return { success: false, error: error.message };
    }
  }
})); 