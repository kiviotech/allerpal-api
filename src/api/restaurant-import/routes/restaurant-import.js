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
      method: 'POST',
      path: '/restaurant-import/process-uploaded-file',
      handler: 'restaurant-import.processUploadedFile',
      config: {
        policies: [],
        middlewares: [],
        description: 'Process a file already uploaded to the media library',
      },
    },
    {
      method: 'POST',
      path: '/restaurant-import/validate',
      handler: 'restaurant-import.validate',
      config: {
        policies: [],
        middlewares: [],
        description: 'Validate import data without making changes',
      },
    },
    {
      method: 'POST',
      path: '/restaurant-import/import-json',
      handler: 'restaurant-import.importJson',
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
    {
      method: 'GET',
      path: '/restaurant-imports',
      handler: 'restaurant-import.find',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/restaurant-imports/:id',
      handler: 'restaurant-import.findOne',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/restaurant-imports',
      handler: 'restaurant-import.create',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/restaurant-imports/:id',
      handler: 'restaurant-import.update',
      config: {
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/restaurant-imports/:id',
      handler: 'restaurant-import.delete',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/restaurant-imports/:id/test-process',
      handler: 'test-import.testProcessImport',
      config: {
        policies: [],
        description: 'Test the restaurant import processing with optimized settings',
        tag: {
          plugin: 'restaurant-import',
          name: 'Test Import',
          actionType: 'process'
        }
      },
    },
  ],
}; 