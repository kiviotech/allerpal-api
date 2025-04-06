'use strict';

module.exports = ({ strapi }) => ({
  async processRestaurantResponse(chatId, content, timestamp) {
    try {
      // Update chat status and last message
      const updatedChat = await strapi.entityService.update('api::chat.chat', chatId, {
        data: {
          status: 'responded',
          lastMessage: content,
          lastMessageTime: timestamp
        }
      });

      // Create new message record
      await strapi.entityService.create('api::message.message', {
        data: {
          text: content,
          sender: 'restaurant',
          timestamp,
          chat: chatId,
          read: false
        }
      });

      // Trigger notification
      await strapi.service('api::notification.notification').create({
        data: {
          type: 'chat_reply',
          user: updatedChat.user.id,
          restaurant: updatedChat.restaurant.id,
          chat: chatId,
          message: `New reply from ${updatedChat.restaurant.name}`
        }
      });

      return updatedChat;
    } catch (error) {
      strapi.log.error('Error processing restaurant response:', error);
      throw error;
    }
  }
});