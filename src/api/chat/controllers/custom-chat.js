'use strict';

/**
 * Custom chat controller for operations that need special handling
 */

module.exports = {
  /**
   * Create a chat with proper error handling
   * @param {Object} ctx - Koa context
   */
  async createChat(ctx) {
    try {
      const { data } = ctx.request.body;
      
      if (!data) {
        return ctx.badRequest('Missing data object in request body');
      }
      
      // Log the request for debugging
      strapi.log.info('Creating chat with data:', data);
      
      // Validate required fields
      if (!data.user || !data.user.id) {
        return ctx.badRequest('Missing user.id in request data');
      }
      
      // Check if we have restaurant.id or restaurant.documentId
      if (!data.restaurant || (!data.restaurant.id && !data.restaurant.documentId)) {
        return ctx.badRequest('Missing restaurant.id or restaurant.documentId in request data');
      }
      
      // If we have documentId but not id, find the restaurant by documentId
      let restaurantId = data.restaurant.id;
      if (!restaurantId && data.restaurant.documentId) {
        strapi.log.info('Finding restaurant by documentId:', data.restaurant.documentId);
        
        // Find restaurant by documentId
        const restaurants = await strapi.entityService.findMany('api::restaurant.restaurant', {
          filters: {
            documentId: data.restaurant.documentId
          }
        });
        
        if (restaurants && restaurants.length > 0) {
          restaurantId = restaurants[0].id;
          strapi.log.info('Found restaurant with id:', restaurantId);
        } else {
          return ctx.badRequest(`Restaurant with documentId ${data.restaurant.documentId} not found`);
        }
      }
      
      // Prepare the data for creating the chat
      const chatData = {
        user: data.user.id,
        restaurant: restaurantId,
        lastMessage: data.lastMessage || '',
        lastMessageTime: data.lastMessageTime || new Date().toISOString(),
        unreadCount: data.unreadCount || 0,
        status: data.status || 'active',
        publishedAt: new Date().toISOString()
      };
      
      // Create the chat entry
      const chat = await strapi.entityService.create('api::chat.chat', {
        data: chatData,
        populate: ['user', 'restaurant']
      });
      
      // Log the created chat for debugging
      strapi.log.info('Chat created successfully with ID:', chat.id);
      
      // Return the created chat with a consistent structure
      return {
        data: {
          id: chat.id,
          ...chat
        }
      };
    } catch (error) {
      strapi.log.error('Error creating chat:', error);
      return ctx.badRequest('Failed to create chat', { error: error.message });
    }
  },
  
  /**
   * Update a chat with proper error handling
   * @param {Object} ctx - Koa context
   */
  async updateChat(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      
      if (!id) {
        return ctx.badRequest('Missing chat ID in request params');
      }
      
      if (!data) {
        return ctx.badRequest('Missing data object in request body');
      }
      
      // Log the request for debugging
      strapi.log.info(`Updating chat ${id} with data:`, data);
      
      // Check if the chat exists
      const existingChat = await strapi.entityService.findOne('api::chat.chat', id, {
        populate: ['user', 'restaurant']
      });
      
      if (!existingChat) {
        return ctx.notFound(`Chat with ID ${id} not found`);
      }
      
      // Prepare the data for updating the chat
      const updateData = {
        lastMessage: data.lastMessage !== undefined ? data.lastMessage : existingChat.lastMessage,
        lastMessageTime: data.lastMessageTime !== undefined ? data.lastMessageTime : existingChat.lastMessageTime,
        unreadCount: data.unreadCount !== undefined ? data.unreadCount : existingChat.unreadCount,
        status: data.status !== undefined ? data.status : existingChat.status,
        reminderScheduled: data.reminderScheduled !== undefined ? data.reminderScheduled : existingChat.reminderScheduled
      };
      
      // Update the chat entry
      const updatedChat = await strapi.entityService.update('api::chat.chat', id, {
        data: updateData,
        populate: ['user', 'restaurant']
      });
      
      // Log the updated chat for debugging
      strapi.log.info(`Chat ${id} updated successfully`);
      
      // Return the updated chat with a consistent structure
      return {
        data: {
          id: updatedChat.id,
          ...updatedChat
        }
      };
    } catch (error) {
      strapi.log.error(`Error updating chat:`, error);
      return ctx.badRequest('Failed to update chat', { error: error.message });
    }
  },

  /**
   * Check for new messages across all user chats
   * @param {Object} ctx - The Koa context
   */
  async checkNewMessages(ctx) {
    try {
      const { userId } = ctx.query;
      
      if (!userId) {
        return ctx.badRequest('User ID is required');
      }
      
      strapi.log.info(`[CheckNewMessages] Starting check for user ${userId} at ${new Date().toISOString()}`);
      
      // Queue an email check job
      strapi.log.info(`[CheckNewMessages] Queueing email check job for user ${userId}...`);
      
      try {
        const emailQueue = strapi.emailQueue || strapi.services['email-queue'];
        if (emailQueue) {
          const job = await emailQueue.addCheckEmailsJob();
          strapi.log.info(`[CheckNewMessages] Email check job queued with ID: ${job.id}`);
        } else {
          strapi.log.warn(`[CheckNewMessages] Email queue service not available, skipping email check`);
        }
      } catch (error) {
        strapi.log.error('[CheckNewMessages] Error queueing email check:', error);
        // Continue with the rest of the function even if email check fails
      }
      
      // Find all chats with unread messages for this user
      const chats = await strapi.entityService.findMany('api::chat.chat', {
        filters: {
          customer: userId,
          unreadCount: { $gt: 0 },
        },
        sort: { lastMessageTime: 'desc' },
        populate: ['lastMessage', 'restaurant'],
      });
      
      strapi.log.info(`[CheckNewMessages] Found ${chats.length} chats with unread messages for user ${userId}`);
      
      // Format the response
      const result = chats.map(chat => ({
        id: chat.id,
        unreadCount: chat.unreadCount,
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        status: chat.status,
        restaurant: chat.restaurant ? {
          id: chat.restaurant.id,
          name: chat.restaurant.name,
          image: chat.restaurant.image
        } : null
      }));
      
      strapi.log.info(`[CheckNewMessages] Completed check for user ${userId}`);
      
      return result;
    } catch (error) {
      strapi.log.error('Error checking new messages:', error);
      throw error;
    }
  },

  /**
   * Check for new chat messages
   * @param {Object} ctx - The Koa context
   */
  async checkChatMessages(ctx) {
    try {
      const { id } = ctx.params;
      const { lastMessageTime } = ctx.query;
      
      if (!id) {
        return ctx.badRequest('Chat ID is required');
      }
      
      strapi.log.info(`[CheckChatMessages] Starting check for chat ${id} at ${new Date().toISOString()}`);
      
      // Get initial state of the chat for comparison
      const initialChat = await strapi.entityService.findOne('api::chat.chat', id, {
        populate: ['messages', 'restaurant']
      });
      
      if (!initialChat) {
        return ctx.notFound(`Chat with ID ${id} not found`);
      }
      
      // Log initial state
      const initialState = {
        messageCount: initialChat.messages?.length || 0,
        unreadCount: initialChat.unreadCount || 0,
        lastMessageTime: initialChat.lastMessageTime,
        status: initialChat.status,
        restaurantName: initialChat.restaurant?.name || 'Unknown'
      };
      
      strapi.log.info(`[CheckChatMessages] Initial state for chat ${id}:`, initialState);
      
      // Queue an email check job instead of checking directly
      strapi.log.info(`[CheckChatMessages] Queueing email check job for chat ${id}...`);
      
      try {
        const emailQueue = strapi.emailQueue || strapi.services['email-queue'];
        if (emailQueue) {
          const job = await emailQueue.addCheckChatEmailsJob(id);
          strapi.log.info(`[CheckChatMessages] Email check job queued with ID: ${job.id} for chat ${id}`);
        } else {
          strapi.log.warn(`[CheckChatMessages] Email queue service not available, skipping email check for chat ${id}`);
        }
      } catch (error) {
        strapi.log.error(`[CheckChatMessages] Error queueing email check for chat ${id}:`, error);
        // Continue with the rest of the function even if email check fails
      }
      
      // Find the chat and any new messages
      const chat = await strapi.entityService.findOne('api::chat.chat', id, {
        populate: ['messages'],
      });
      
      if (!chat) {
        return ctx.notFound(`Chat with ID ${id} not found`);
      }
      
      // Filter messages based on lastMessageTime
      let newMessages = [];
      if (lastMessageTime) {
        const lastMessageDate = new Date(lastMessageTime);
        newMessages = chat.messages.filter(msg => new Date(msg.createdAt) > lastMessageDate);
      } else {
        newMessages = chat.messages;
      }
      
      strapi.log.info(`[CheckChatMessages] Found ${newMessages.length} new messages for chat ${id} since ${lastMessageTime || 'beginning'}`);
      strapi.log.info(`[CheckChatMessages] Completed check for chat ${id}`);
      
      // Return the new messages and chat status
      return {
        messages: newMessages,
        status: chat.status,
        unreadCount: chat.unreadCount,
        lastMessageTime: chat.lastMessageTime,
      };
    } catch (error) {
      strapi.log.error('Error checking chat messages:', error);
      throw error;
    }
  }
}; 