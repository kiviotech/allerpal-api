'use strict';

/**
 * guest-room service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::guest-room.guest-room');
