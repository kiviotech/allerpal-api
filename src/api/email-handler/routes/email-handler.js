'use strict';

/**
 * Email handler router
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/email-webhook',
      handler: 'email-handler.handleIncomingEmail',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // No authentication required for webhook
      },
    },
  ],
}; 