'use strict';

const emailPollerModule = require('./services/email-poller');
const emailQueueModule = require('./services/email-queue');

module.exports = async ({ strapi }) => {
  console.log('=== Bootstrap: Starting to initialize application services... ===');
  
  try {
    // Initialize email queue service first
    console.log('=== Bootstrap: Starting to initialize email queue service... ===');
    try {
      const emailQueue = emailQueueModule(strapi);
      await emailQueue.initialize();
      
      // Store the service instance for reference
      strapi.emailQueue = emailQueue;
      
      // Also register the service in the services registry
      strapi.services['email-queue'] = emailQueue;
      
      console.log('=== Bootstrap: Email queue service successfully initialized ===');
    } catch (queueError) {
      console.error('=== Bootstrap: Failed to initialize email queue service ===', queueError);
      console.log('=== Bootstrap: Continuing startup despite email queue initialization failure ===');
      // Continue with startup even if email queue fails
    }
    
    // Initialize simplified email test service
    console.log('=== Bootstrap: Starting to initialize email test service... ===');
    const emailPoller = emailPollerModule({ strapi });
    
    // Start the service (this will run the test connection after Strapi loads)
    await emailPoller.start();
    
    // Store the service instance for cleanup
    strapi.emailPoller = emailPoller;
    
    // Also register the service in the services registry for backward compatibility
    strapi.services['email-poller'] = emailPoller;
    
    console.log('=== Bootstrap: Email test service successfully initialized and started ===');
    
    // Register cleanup handlers
    const cleanup = async () => {
      console.log('=== Bootstrap: Cleaning up services... ===');
      
      // Clean up email poller
      if (strapi.emailPoller) {
        console.log('=== Bootstrap: Cleaning up email test service... ===');
        await strapi.emailPoller.stop();
        delete strapi.emailPoller;
        delete strapi.services['email-poller'];
      }
      
      // Clean up email queue
      if (strapi.emailQueue) {
        console.log('=== Bootstrap: Cleaning up email queue service... ===');
        await strapi.emailQueue.close();
        delete strapi.emailQueue;
        delete strapi.services['email-queue'];
      }
      
      console.log('=== Bootstrap: All services cleaned up ===');
    };

    // Clean up on server shutdown
    strapi.server.httpServer.on('close', cleanup);
    
    // Also handle process termination
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    console.log('=== Bootstrap: Email test service successfully initialized ===');
  } catch (error) {
    console.error('=== Bootstrap: Failed to initialize email test service ===', error);
  }
}; 