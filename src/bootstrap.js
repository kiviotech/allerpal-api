'use strict';

const emailPollerModule = require('./services/email-poller');

module.exports = async ({ strapi }) => {
  console.log('=== Bootstrap: Starting to initialize email test service... ===');
  
  try {
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