'use strict';

const bullmq = require('bullmq');
const Redis = require('ioredis').default;


/**
 * Email Queue Service for handling email checking in the background
 */
class EmailQueueService {
  constructor(strapi) {
    this.strapi = strapi;
    this.initialized = false;
   
    this.connection = null;
   
    this.emailQueue = null;
    this.initializationPromise = null;
    
    // Don't initialize in constructor, wait for Strapi lifecycle
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 3;
  }

  /**
   * Initialize the email queue service
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  async _initialize() {
    try {
      this.initializationAttempts++;

      // Ensure we have required environment variables
      if (!process.env.REDIS_HOST) {
        throw new Error('REDIS_HOST environment variable is required');
      }

      // Create Redis connection with better error handling
      this.connection = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        retryStrategy(times) {
          const delay = Math.min(times * 1000, 30000);
          return delay;
        },
        reconnectOnError(err) {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            // Only reconnect on specific errors
            return true;
          }
          return false;
        }
      });

      // Handle Redis connection events
      this.connection.on('error', (error) => {
        this.strapi.log.error('[EmailQueue] Redis connection error:', error);
        this.initialized = false;
      });

      this.connection.on('ready', () => {
        this.strapi.log.info('[EmailQueue] Redis connection ready');
      });

      // Create the email queue with improved options
      this.emailQueue = new bullmq.Queue('email-check', {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 100,
          timeout: 30000, // 30 second timeout for jobs
        }
      });

      // Handle queue events
      this.emailQueue.on('error', (error) => {
        this.strapi.log.error('[EmailQueue] Queue error:', error);
      });

  
      this.emailQueue.on('failed', (job, error) => {
        this.strapi.log.error(`[EmailQueue] Job ${job.id} failed:`, error);
      });

      this.initialized = true;
      this.strapi.log.info('[EmailQueue] Email queue service initialized successfully');
      
      return true;
    } catch (error) {
      this.strapi.log.error('[EmailQueue] Failed to initialize email queue service:', error);
      
      if (this.initializationAttempts < this.maxInitializationAttempts) {
        this.strapi.log.info(`[EmailQueue] Retrying initialization (attempt ${this.initializationAttempts}/${this.maxInitializationAttempts})`);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this._initialize();
      }
      
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }


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
   * @returns {Promise<any>} - The created job
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

module.exports = ({ strapi }) => {
  const service = new EmailQueueService(strapi);
  
  // Register lifecycle hooks
  strapi.hook('strapi::server.afterStart').register(() => {
    return service.initialize();
  });
  
  strapi.hook('strapi::server.beforeStop').register(() => {
    return service.close();
  });
  
  return service;
}; 