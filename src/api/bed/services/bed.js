'use strict';

/**
 * bed service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::bed.bed');
