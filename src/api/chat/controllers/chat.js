'use strict';

/**
 * Chat controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

// Export a function that returns an object with controller methods
module.exports = ({ strapi }) => ({
  // Find method to get all chats with filters
  async find(ctx) {
    try {
      // Get the query parameters
      const { query } = ctx;
      
      // Log the query for debugging
      strapi.log.info('Finding chats with query:', query);
      
      // Use the entity service to find chats
      const chats = await strapi.entityService.findMany('api::chat.chat', {
        filters: query.filters || {},
        sort: query.sort || { lastMessageTime: 'desc' },
        populate: query.populate || '*',
        fields: query.fields,
        pagination: query.pagination
      });
      
      // Return the chats
      return { data: chats };
    } catch (error) {
      strapi.log.error('Error finding chats:', error);
      ctx.throw(500, error);
    }
  },
  
  // FindOne method to get a single chat by ID
  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      
      // Log the ID for debugging
      strapi.log.info(`Finding chat with ID: ${id}`);
      
      // Use the entity service to find the chat
      const chat = await strapi.entityService.findOne('api::chat.chat', id, {
        populate: ctx.query.populate || '*'
      });
      
      if (!chat) {
        return ctx.notFound('Chat not found');
      }
      
      // Return the chat
      return { data: chat };
    } catch (error) {
      strapi.log.error(`Error finding chat with ID ${ctx.params.id}:`, error);
      ctx.throw(500, error);
    }
  },
  
  // Create method to create a new chat
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      
      if (!data) {
        return ctx.badRequest('Missing data object in request body');
      }
      
      // Log the data for debugging
      strapi.log.info('Creating chat with data:', data);
      
      // Use the entity service to create the chat
      const chat = await strapi.entityService.create('api::chat.chat', {
        data,
        populate: '*'
      });
      
      // Return the created chat
      return { data: chat };
    } catch (error) {
      strapi.log.error('Error creating chat:', error);
      ctx.throw(500, error);
    }
  },
  
  // Update method to update an existing chat
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      
      if (!data) {
        return ctx.badRequest('Missing data object in request body');
      }
      
      // Log the data for debugging
      strapi.log.info(`Updating chat ${id} with data:`, data);
      
      // Use the entity service to update the chat
      const chat = await strapi.entityService.update('api::chat.chat', id, {
        data,
        populate: '*'
      });
      
      if (!chat) {
        return ctx.notFound('Chat not found');
      }
      
      // Return the updated chat
      return { data: chat };
    } catch (error) {
      strapi.log.error(`Error updating chat with ID ${ctx.params.id}:`, error);
      ctx.throw(500, error);
    }
  },
  
  // Delete method to delete a chat
  async delete(ctx) {
    try {
      const { id } = ctx.params;
      
      // Log the ID for debugging
      strapi.log.info(`Deleting chat with ID: ${id}`);
      
      // Use the entity service to delete the chat
      const chat = await strapi.entityService.delete('api::chat.chat', id);
      
      if (!chat) {
        return ctx.notFound('Chat not found');
      }
      
      // Return the deleted chat
      return { data: chat };
    } catch (error) {
      strapi.log.error(`Error deleting chat with ID ${ctx.params.id}:`, error);
      ctx.throw(500, error);
    }
  }
}); 