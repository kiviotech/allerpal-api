'use strict';

/**
 * inboxx service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::inboxx.inboxx');
