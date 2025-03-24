'use strict';

/**
 * chat service
 */

module.exports = ({ strapi }) => ({
  async processRestaurantReply(chatId, replyText) {
    try {
      // Get the chat
      const chat = await strapi.entityService.findOne('api::chat.chat', chatId, {
        populate: ['messages']
      });

      if (!chat) {
        throw new Error(`Chat not found with ID: ${chatId}`);
      }

      // Add restaurant's reply as a message
      await strapi.entityService.create('api::message.message', {
        data: {
          text: replyText,
          sender: 'restaurant',
          timestamp: new Date().toISOString(),
          read: false,
          chat: chatId
        }
      });

      // Update chat status
      const updatedChat = await strapi.entityService.update('api::chat.chat', chatId, {
        data: {
          lastMessage: replyText,
          lastMessageTime: new Date().toISOString(),
          status: 'responded',
          unreadCount: (chat.unreadCount || 0) + 1
        }
      });

      return updatedChat;
    } catch (error) {
      console.error('[Chat Service] Error processing restaurant reply:', error);
      throw error;
    }
  },

  async addMessageToChat(chatId, messageData) {
    try {
      return await strapi.entityService.create('api::message.message', {
        data: {
          ...messageData,
          chat: chatId
        }
      });
    } catch (error) {
      console.error('[Chat Service] Error adding message to chat:', error);
      throw error;
    }
  }
}); 