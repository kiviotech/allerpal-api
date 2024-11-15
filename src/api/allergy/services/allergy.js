'use strict';

/**
 * allergy service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::allergy.allergy');
