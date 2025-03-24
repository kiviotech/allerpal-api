'use strict';

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

/**
 * Email Queue Service for handling email checking in the background
 */
class EmailQueueService {
  constructor(strapi) {
    this.strapi = strapi;
    this.initialized = false;
    this.connection = null;
    this.emailQueue = null;
    
    this.initialize();
  }

  /**
   * Initialize the email queue service
   */
  initialize() {
    try {
      // Create Redis connection
      this.connection = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
      });

      // Create the email queue
      this.emailQueue = new Queue('email-check', {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100, // Keep only 100 completed jobs
          removeOnFail: 100, // Keep only 100 failed jobs
        }
      });

      this.initialized = true;
      this.strapi.log.info('[EmailQueue] Email queue service initialized successfully');
    } catch (error) {
      this.strapi.log.error('[EmailQueue] Failed to initialize email queue service:', error);
      throw error;
    }
  }

  /**
   * Add a job to check for new emails
   * @param {Object} data - Job data
   * @param {Object} options - Job options
   * @returns {Promise<Job>} - The created job
   */
  async addCheckEmailsJob(data = {}, options = {}) {
    if (!this.initialized) {
      this.strapi.log.error('[EmailQueue] Email queue service not initialized');
      throw new Error('Email queue service not initialized');
    }

    try {
      const job = await this.emailQueue.add('check-emails', data, {
        ...options,
        // Add timestamp for tracking
        timestamp: new Date().toISOString(),
      });

      this.strapi.log.info(`[EmailQueue] Added check-emails job ${job.id}`);
      return job;
    } catch (error) {
      this.strapi.log.error('[EmailQueue] Failed to add check-emails job:', error);
      throw error;
    }
  }

  /**
   * Add a job to check for new emails for a specific chat
   * @param {string|number} chatId - The ID of the chat to check
   * @returns {Promise<Object>} - The created job
   */
  async addCheckChatEmailsJob(chatId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Ensure chatId is valid
      if (!chatId) {
        throw new Error('Chat ID is required');
      }

      const jobData = { 
        chatId: chatId,
        timestamp: new Date().toISOString() 
      };

      // Add the job to the queue
      this.strapi.log.info(`[EmailQueue] Adding check-chat-emails job for chat ${chatId}`);
      
      const job = await this.emailQueue.add(
        'check-chat-emails',
        jobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000
          },
          removeOnComplete: true,
          removeOnFail: false
        }
      );

      return job;
    } catch (error) {
      this.strapi.log.error(`[EmailQueue] Error adding check-chat-emails job:`, error);
      throw error;
    }
  }

  /**
   * Add a repeated job to check for new emails
   * @param {Object} options - Job options
   * @returns {Promise<Object>} - The created job
   */
  async addRepeatedEmailCheckJob(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const defaultOptions = {
        repeat: {
          every: 5 * 60 * 1000, // Default: every 5 minutes
        },
        backoff: {
          type: 'exponential',
          delay: 30000, // Start with 30s delay for retries
        },
        removeOnComplete: false,
        removeOnFail: false,
      };

      const mergedOptions = {
        ...defaultOptions,
        ...options,
      };

      this.strapi.log.info(`[EmailQueue] Adding repeated check-emails job with pattern:`, 
        mergedOptions.repeat);

      const job = await this.emailQueue.add(
        'check-emails',
        { timestamp: new Date().toISOString() },
        mergedOptions
      );

      return job;
    } catch (error) {
      this.strapi.log.error('[EmailQueue] Error adding repeated check-emails job:', error);
      throw error;
    }
  }

  /**
   * Clean up resources when shutting down
   */
  async close() {
    try {
      if (this.emailQueue) {
        await this.emailQueue.close();
        this.strapi.log.info('[EmailQueue] Email queue closed');
      }
      
      if (this.connection) {
        await this.connection.quit();
        this.strapi.log.info('[EmailQueue] Redis connection closed');
      }
      
      this.initialized = false;
    } catch (error) {
      this.strapi.log.error('[EmailQueue] Error closing email queue:', error);
    }
  }
}

module.exports = EmailQueueService; 