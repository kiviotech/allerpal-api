// path: config/middlewares.js

module.exports = ({ env }) => [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'your-cdn-domain.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'your-cdn-domain.com'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      prefix: '/dash',
    },
  },
  'strapi::session',
  'strapi::favicon',
  {
    name: 'strapi::public',
    config: {
      path: '/dash',
    },
  },
];
