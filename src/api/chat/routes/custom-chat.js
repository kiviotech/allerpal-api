'use strict';

/**
 * Custom chat routes for operations that need special handling
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/create-chat',
      handler: 'custom-chat.createChat',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/update-chat/:id',
      handler: 'custom-chat.updateChat',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/check-new-messages',
      handler: 'custom-chat.checkNewMessages',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/check-chat-messages/:id',
      handler: 'custom-chat.checkChatMessages',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 