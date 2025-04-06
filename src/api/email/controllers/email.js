'use strict';

/**
 * A set of functions called "actions" for `email`
 */

const { sanitizeEntity } = require('@strapi/utils');

module.exports = {
  async testEmail(ctx) {
    try {
      const { to, subject, text } = ctx.request.body;

      if (!to || !subject || !text) {
        return ctx.badRequest('Missing required fields: to, subject, text');
      }

      // Get the email configuration from environment variables
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        auth: {
          user: process.env.SMTP_USERNAME || 'prithvihhh@gmail.com',
          pass: process.env.SMTP_PASSWORD || 'ziuvuxrmytzwixvc'
        }
      };

      // Create transporter
      const transporter = require('nodemailer').createTransport(emailConfig);

      // Send test email
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'prithvihhh@gmail.com',
        to: to,
        subject: subject,
        text: text,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00aced;">Test Email from AllerPal</h2>
          <p>${text}</p>
          <p style="color: #777; font-size: 12px;">This is a test email from AllerPal system</p>
        </div>`
      });

      ctx.body = {
        success: true,
        messageId: info.messageId,
        response: info.response
      };

    } catch (error) {
      console.error('[Email Test] Error:', error);
      ctx.throw(500, error.message);
    }
  },

  async sendChatMessage(ctx) {
    try {
      const { restaurantEmail, userName, message, chatId } = ctx.request.body;

      if (!restaurantEmail || !userName || !message || !chatId) {
        return ctx.badRequest('Missing required fields: restaurantEmail, userName, message, chatId');
      }

      // Get the email configuration from environment variables
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        auth: {
          user: process.env.SMTP_USERNAME || 'prithvihhh@gmail.com',
          pass: process.env.SMTP_PASSWORD || 'ziuvuxrmytzwixvc'
        }
      };

      // Create transporter
      const transporter = require('nodemailer').createTransport(emailConfig);

      // Send chat message email
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'prithvihhh@gmail.com',
        to: restaurantEmail,
        subject: `New message from ${userName} via AllerPal`,
        replyTo: process.env.SMTP_FROM || 'prithvihhh@gmail.com',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #00aced;">New Message from AllerPal User</h2>
            <p><strong>From:</strong> ${userName}</p>
            <p><strong>Message:</strong></p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
              ${message}
            </div>
            <p style="margin-top: 20px;">Please reply directly to this email to respond to the customer.</p>
            <p style="color: #777; font-size: 12px;">Reference: ${chatId}</p>
            <hr />
            <p style="color: #777; font-size: 12px;">This message was sent via AllerPal. Please respond within 24 hours.</p>
          </div>
        `,
        headers: {
          'X-Chat-ID': chatId,
        }
      });

      ctx.body = {
        success: true,
        messageId: info.messageId,
        response: info.response
      };

    } catch (error) {
      console.error('[Email Service] Error:', error);
      ctx.throw(500, error.message);
    }
  },

  async sendReminderEmail(ctx) {
    try {
      const { restaurantEmail, userName, chatId } = ctx.request.body;

      if (!restaurantEmail || !userName || !chatId) {
        return ctx.badRequest('Missing required fields: restaurantEmail, userName, chatId');
      }

      // Get the email configuration from environment variables
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        auth: {
          user: process.env.SMTP_USERNAME || 'prithvihhh@gmail.com',
          pass: process.env.SMTP_PASSWORD || 'ziuvuxrmytzwixvc'
        }
      };

      // Create transporter
      const transporter = require('nodemailer').createTransport(emailConfig);

      // Send reminder email
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'prithvihhh@gmail.com',
        to: restaurantEmail,
        subject: `REMINDER: Unanswered message from ${userName} via AllerPal`,
        replyTo: process.env.SMTP_FROM || 'prithvihhh@gmail.com',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ff6b6b;">Reminder: Unanswered Message</h2>
            <p>You have an unanswered message from <strong>${userName}</strong> that was sent 24 hours ago.</p>
            <p>Please reply to this email as soon as possible to maintain good customer service.</p>
            <p style="color: #777; font-size: 12px;">Reference: ${chatId}</p>
          </div>
        `,
        headers: {
          'X-Chat-ID': chatId,
        }
      });

      ctx.body = {
        success: true,
        messageId: info.messageId,
        response: info.response
      };

    } catch (error) {
      console.error('[Email Service] Error:', error);
      ctx.throw(500, error.message);
    }
  },

  async handleEmailReply(ctx) {
    try {
      const { from, subject, text, chatId } = ctx.request.body;

      if (!from || !text || !chatId) {
        return ctx.badRequest('Missing required fields: from, text, chatId');
      }

      // Get the chat service
      const chatService = strapi.service('api::chat.chat');
      
      // Extract reply text from email
      const replyText = this.extractReplyText(text);
      
      // Process the reply and update chat
      const updatedChat = await chatService.processRestaurantReply(chatId, replyText);

      // Add system message about successful reply
      await chatService.addMessageToChat(chatId, {
        text: "Restaurant has replied to your message.",
        sender: 'system',
        timestamp: new Date().toISOString(),
        read: false
      });

      ctx.body = {
        success: true,
        chat: sanitizeEntity(updatedChat, { model: strapi.models.chat })
      };

    } catch (error) {
      console.error('[Email Service] Error handling reply:', error);
      ctx.throw(500, error.message);
    }
  },

  /**
   * Extract the actual reply text from email body
   * @param {string} emailText - Full email text
   * @returns {string} - Extracted reply text
   */
  extractReplyText(emailText) {
    // Remove any quoted text (usually starts with '>')
    const lines = emailText.split('\n');
    const replyLines = lines.filter(line => !line.trim().startsWith('>'));
    
    // Remove email signatures and footers
    let replyText = replyLines.join('\n').trim();
    
    // Remove common email reply markers
    const markers = [
      'On * wrote:',
      'From:',
      'Sent:',
      'To:',
      'Subject:',
      '________________________________',
      '-------- Original Message --------',
    ];
    
    markers.forEach(marker => {
      const regex = new RegExp(`.*${marker}.*\\n?`, 'gi');
      replyText = replyText.replace(regex, '');
    });
    
    return replyText.trim();
  },

  async triggerEmailCheck(ctx) {
    try {
      // Get the email poller service
      const emailPollerService = strapi.services['email-poller'];
      
      if (!emailPollerService) {
        return ctx.badRequest('Email poller service not available');
      }
      
      // Check if the trigger method exists
      if (typeof emailPollerService.triggerManualCheck !== 'function') {
        return ctx.badRequest('Email poller service does not support manual checks');
      }
      
      // Trigger the manual check
      const result = await emailPollerService.triggerManualCheck();
      
      ctx.body = {
        success: true,
        result
      };
    } catch (error) {
      console.error('[Email Controller] Error triggering email check:', error);
      ctx.throw(500, error.message);
    }
  }
}; 