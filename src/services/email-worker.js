'use strict';

const { Worker } = require('bullmq');
const IORedis = require('ioredis');

/**
 * Email Worker Service for processing email checking jobs
 */
class EmailWorkerService {
  constructor(strapi) {
    this.strapi = strapi;
    this.initialized = false;
    this.connection = null;
    this.worker = null;
    this.emailPoller = null;
    
    this.initialize();
  }

  /**
   * Initialize the email worker service
   */
  async initialize() {
    try {
      // Get the email poller service
      this.emailPoller = this.strapi.emailPoller || this.strapi.services['email-poller'];
      
      if (!this.emailPoller) {
        this.strapi.log.error('[EmailWorker] Email poller service not found');
        throw new Error('Email poller service not found');
      }

      // Create Redis connection
      this.connection = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
      });

      // Create the worker
      this.worker = new Worker('email-check', this.processJob.bind(this), {
        connection: this.connection,
        concurrency: 1, // Process one job at a time to avoid IMAP connection issues
        limiter: {
          max: 1,
          duration: 15000, // Limit to 1 job every 15 seconds
        },
      });

      // Set up event handlers
      this.setupEventHandlers();

      this.initialized = true;
      this.strapi.log.info('[EmailWorker] Email worker service initialized successfully');
      
      return true;
    } catch (error) {
      this.strapi.log.error('[EmailWorker] Error initializing worker:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Set up event handlers for the worker
   */
  setupEventHandlers() {
    // Job completed successfully
    this.worker.on('completed', (job, result) => {
      this.strapi.log.info(`[EmailWorker] Job ${job.id} completed:`, {
        name: job.name,
        result,
        timestamp: new Date().toISOString(),
      });
    });

    // Job failed
    this.worker.on('failed', (job, error) => {
      this.strapi.log.error(`[EmailWorker] Job ${job.id} failed:`, {
        name: job.name,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    });

    // Worker is ready
    this.worker.on('ready', () => {
      this.strapi.log.info('[EmailWorker] Worker is ready');
    });

    // Worker is paused
    this.worker.on('paused', () => {
      this.strapi.log.info('[EmailWorker] Worker is paused');
    });

    // Worker is resumed
    this.worker.on('resumed', () => {
      this.strapi.log.info('[EmailWorker] Worker is resumed');
    });

    // Worker is closed
    this.worker.on('closed', () => {
      this.strapi.log.info('[EmailWorker] Worker is closed');
    });

    // Worker error
    this.worker.on('error', (error) => {
      this.strapi.log.error('[EmailWorker] Worker error:', error);
    });
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
    try {
      const { chatId } = job.data;
      
      if (!chatId) {
        throw new Error('Chat ID is required in job data');
      }

      this.strapi.log.info(`[EmailWorker] Checking for new emails for chat ${chatId}:`, {
        jobId: job.id,
        chatId: chatId,
        timestamp: new Date().toISOString(),
      });

      // Check if the chat exists
      const chat = await this.strapi.entityService.findOne('api::chat.chat', chatId, {
        populate: ['restaurant']
      });

      if (!chat) {
        throw new Error(`Chat with ID ${chatId} not found`);
      }

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
      this.strapi.log.info(`[EmailWorker] Email check details for chat ${chatId}:`, {
        duration: `${endTime - startTime}ms`,
        imapConnected: this.emailPoller.isConnected,
        lastPollTime: this.emailPoller.lastPollTime,
        pollCount: this.emailPoller.pollCount,
        chatId: chatId
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
        duration: endTime - startTime,
        chatId: chatId
      };
    } catch (error) {
      this.strapi.log.error(`[EmailWorker] Error checking emails for chat:`, error);
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

module.exports = EmailWorkerService; 