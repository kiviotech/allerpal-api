'use strict';

const { Worker } = require('bullmq');
const Redis = require('ioredis');

/**
 * Email Worker Service for processing email checking jobs
 */
class EmailWorkerService {
  constructor(strapi) {
    this.strapi = strapi;
    this.emailPoller = strapi.service('email-poller');
    this.setupWorker();
  }

  setupWorker() {
    // Redis connection for BullMQ
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10)
    };

    // Create worker
    this.worker = new Worker('email-queue', async (job) => {
      this.strapi.log.info(`[EmailWorker] Processing job ${job.id} of type ${job.name}`);
      
      try {
        switch (job.name) {
          case 'check-emails':
            return await this.processCheckEmailsJob(job);
          case 'check-chat-emails':
            return await this.processCheckChatEmailsJob(job);
          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      } catch (error) {
        this.strapi.log.error(`[EmailWorker] Error processing job ${job.id}:`, error);
        throw error;
      }
    }, { connection });
  }

  /**
   * Process a job
   * @param {Object} job - The job to process
   * @returns {Promise<Object>} - The result of the job
   */
  async processJob(job) {
    this.strapi.log.info(`[EmailWorker] Processing job ${job.id}:`, {
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: new Date().toISOString(),
    });

    try {
      // Add a random delay to avoid connection collisions
      const delay = Math.floor(Math.random() * 5000) + 2000; // Random delay between 2-7 seconds
      this.strapi.log.info(`[EmailWorker] Adding delay of ${delay}ms before processing job ${job.id}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      let result;

      switch (job.name) {
        case 'check-emails':
          result = await this.processCheckEmailsJob(job);
          break;
        case 'check-chat-emails':
          result = await this.processCheckChatEmailsJob(job);
          break;
        case 'check-emails-repeated':
          result = await this.processCheckEmailsJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      this.strapi.log.info(`[EmailWorker] Job ${job.id} processed successfully:`, {
        result,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.strapi.log.error(`[EmailWorker] Error processing job ${job.id}:`, error);
      this.strapi.log.error(`[EmailWorker] Job ${job.id} failed:`, {
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Process a check-emails job
   * @param {Object} job - The job to process
   * @returns {Promise<Object>} - The result of the job
   */
  async processCheckEmailsJob(job) {
    this.strapi.log.info(`[EmailWorker] Checking for new emails:`, {
      jobId: job.id,
      timestamp: new Date().toISOString(),
    });

    // Log IMAP configuration
    this.strapi.log.info('[EmailWorker] IMAP Configuration:', {
      host: process.env.SMTP_HOST || 'imap.gmail.com',
      port: 993,
      user: process.env.SMTP_USERNAME ? 'Configured' : 'Missing',
      tls: true,
      isConnected: this.emailPoller.isConnected,
    });

    // Check for new emails
    const startTime = new Date();
    const result = await this.emailPoller.checkEmails();
    const endTime = new Date();

    // Log email check details
    this.strapi.log.info(`[EmailWorker] Email check details:`, {
      duration: `${endTime - startTime}ms`,
      imapConnected: this.emailPoller.isConnected,
      lastPollTime: this.emailPoller.lastPollTime,
      pollCount: this.emailPoller.pollCount,
      checkResult: result
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      duration: endTime - startTime,
    };
  }

  /**
   * Process a check-chat-emails job
   * @param {Object} job - The job to process
   * @returns {Promise<Object>} - The result of the job
   */
  async processCheckChatEmailsJob(job) {
    const jobChatId = job.data.chatId;
    
    try {
      if (!jobChatId) {
        throw new Error('Chat ID is required in job data');
      }

      this.strapi.log.info(`[EmailWorker] Checking for new emails for chat ${jobChatId}:`, {
        jobId: job.id,
        chatId: jobChatId,
        timestamp: new Date().toISOString(),
      });

      // Check if the chat exists
      const chat = await this.strapi.entityService.findOne('api::chat.chat', jobChatId, {
        populate: ['restaurant', 'emailMetadata']
      });

      if (!chat) {
        throw new Error(`Chat with ID ${jobChatId} not found`);
      }

      // Log IMAP configuration
      this.strapi.log.info('[EmailWorker] IMAP Configuration:', {
        host: process.env.SMTP_HOST || 'imap.gmail.com',
        port: 993,
        user: process.env.SMTP_USERNAME ? 'Configured' : 'Missing',
        tls: true,
        isConnected: this.emailPoller.isConnected,
      });

      // Check for new emails with metadata matching
      const startTime = new Date().getTime();
      let result;
      
      try {
        // Build search criteria based on chat metadata
        const searchCriteria = [];
        searchCriteria.push('UNSEEN');
        
        // If we have a previous message ID, search for replies
        if (chat.emailMetadata?.messageId) {
          searchCriteria.push('OR');
          searchCriteria.push(['HEADER', 'in-reply-to', chat.emailMetadata.messageId]);
          searchCriteria.push(['HEADER', 'references', chat.emailMetadata.messageId]);
        }
        
        // Add date constraint
        const lastCheck = chat.emailMetadata?.lastProcessedAt 
          ? new Date(chat.emailMetadata.lastProcessedAt)
          : new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours if no previous check
          
        searchCriteria.push('SINCE');
        searchCriteria.push(lastCheck);
        
        result = await this.emailPoller.checkEmails(searchCriteria);
      } catch (error) {
        this.strapi.log.error('[EmailWorker] Error checking emails:', error);
        throw error;
      }
      
      const endTime = new Date().getTime();
      const duration = endTime - startTime;

      // Log email check details
      this.strapi.log.info(`[EmailWorker] Email check details for chat ${jobChatId}:`, {
        duration: `${duration}ms`,
        imapConnected: this.emailPoller.isConnected,
        lastPollTime: this.emailPoller.lastPollTime,
        pollCount: this.emailPoller.pollCount,
        chatId: jobChatId,
        emailsFound: result?.messagesFound || 0,
        emailsProcessed: result?.messagesProcessed || 0
      });

      // Update last check time even if no new messages
      await this.strapi.entityService.update('api::chat.chat', jobChatId, {
        data: {
          emailMetadata: {
            ...chat.emailMetadata,
            lastProcessedAt: new Date().toISOString()
          }
        }
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
        duration,
        chatId: jobChatId,
        emailsFound: result?.messagesFound || 0,
        emailsProcessed: result?.messagesProcessed || 0
      };
    } catch (error) {
      this.strapi.log.error(`[EmailWorker] Error checking emails for chat:`, error);
      
      // Try to update chat status on error
      try {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          await this.strapi.entityService.update('api::chat.chat', jobChatId, {
            data: {
              status: 'failed',
              lastError: {
                message: error.message,
                code: error.code,
                timestamp: new Date().toISOString()
              }
            }
          });
        }
      } catch (updateError) {
        this.strapi.log.error('[EmailWorker] Error updating chat status:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Clean up resources when shutting down
   */
  async close() {
    try {
      if (this.worker) {
        await this.worker.close();
        this.strapi.log.info('[EmailWorker] Worker closed');
      }

      if (this.connection) {
        await this.connection.quit();
        this.strapi.log.info('[EmailWorker] Redis connection closed');
      }

      this.initialized = false;
    } catch (error) {
      this.strapi.log.error('[EmailWorker] Error closing worker:', error);
    }
  }
}

module.exports = ({ strapi }) => {
  return new EmailWorkerService(strapi);
}; 