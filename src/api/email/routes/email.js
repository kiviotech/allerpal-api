'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/api/email/test-email',
      handler: 'email.testEmail',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/api/email/send-chat-message',
      handler: 'email.sendChatMessage',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/api/email/send-reminder',
      handler: 'email.sendReminderEmail',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/api/email/handle-reply',
      handler: 'email.handleEmailReply',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/api/email/check-emails',
      handler: 'email.triggerEmailCheck',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 