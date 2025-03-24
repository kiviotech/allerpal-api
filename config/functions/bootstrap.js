'use strict';

const EmailPollerService = require('../../src/services/email-poller');

module.exports = async ({ strapi }) => {
  console.log('=== Bootstrap: Starting to initialize email poller... ===');
  try {
    // Initialize email poller service
    const emailPoller = new EmailPollerService(strapi);
    
    // Start polling for emails
    await emailPoller.start();
    
    // Store the service instance for cleanup
    strapi.emailPoller = emailPoller;
    
    // Also register the service in the services registry for backward compatibility
    strapi.services['email-poller'] = emailPoller;
    
    // Register cleanup handlers
    const cleanup = async () => {
      console.log('=== Bootstrap: Cleaning up email poller... ===');
      if (strapi.emailPoller) {
        await strapi.emailPoller.stop();
        delete strapi.emailPoller;
        delete strapi.services['email-poller'];
      }
    };

    // Clean up on server shutdown
    strapi.server.httpServer.on('close', cleanup);
    
    // Also handle process termination
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    console.log('=== Bootstrap: Email poller successfully initialized and started ===');
  } catch (error) {
    console.error('=== Bootstrap: Failed to initialize email poller ===', error);
  }
}; 