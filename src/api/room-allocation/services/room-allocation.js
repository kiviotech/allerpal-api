'use strict';

/**
 * room-allocation service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::room-allocation.room-allocation');
