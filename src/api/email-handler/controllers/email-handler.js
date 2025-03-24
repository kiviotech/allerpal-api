'use strict';

/**
 * Email handler controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::email-handler.email-handler', ({ strapi }) => ({
  /**
   * Handle incoming emails from restaurants
   * @param {Object} ctx - Koa context
   */
  async handleIncomingEmail(ctx) {
    try {
      const { body } = ctx.request;
      
      // Log the incoming email
      strapi.log.info('Received email webhook:', body);
      
      // Process the email using the service
      const result = await strapi.service('api::email-handler.email-handler').processIncomingEmail(body);
      
      if (!result.success) {
        return ctx.badRequest(result.error);
      }
      
      // Return success
      return ctx.send({
        message: result.message,
        chatId: result.chatId
      });
    } catch (error) {
      strapi.log.error('Error processing incoming email:', error);
      return ctx.badRequest('Error processing email', { error: error.message });
    }
  },
  
  // Keep the default find method
  async find(ctx) {
    // Call the default find method
    const { data, meta } = await super.find(ctx);
    
    // Return the response
    return { data, meta };
  },
  
  // Keep the default findOne method
  async findOne(ctx) {
    // Call the default findOne method
    const { data, meta } = await super.findOne(ctx);
    
    // Return the response
    return { data, meta };
  }
})); 