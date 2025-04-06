'use strict';

module.exports = ({ strapi }) => ({
  async create({ data }) {
    try {
      // Create notification record
      const notification = await strapi.entityService.create('api::notification.notification', {
        data: {
          ...data,
          read: false
        }
      });

      // TODO: Integrate with push notification service
      console.log('Notification created:', notification.id);

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  async markAsRead(notificationId) {
    return strapi.entityService.update('api::notification.notification', notificationId, {
      data: { read: true }
    });
  }
});