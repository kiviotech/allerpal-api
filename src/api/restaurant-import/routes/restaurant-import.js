'use strict';

/**
 * restaurant-import router
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/restaurant-import/upload',
      handler: 'restaurant-import.upload',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/restaurant-import/download-template',
      handler: 'restaurant-import.downloadTemplate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/restaurant-import/:id',
      handler: 'restaurant-import.getImport',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/restaurant-import',
      handler: 'restaurant-import.listImports',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 