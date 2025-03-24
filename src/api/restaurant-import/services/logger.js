'use strict';

/**
 * Logger service for restaurant import
 * Logs the progress and results of restaurant imports
 */
module.exports = {
  /**
   * Create a new import log entry
   * @param {Object} fileInfo - Information about the imported file
   * @returns {Object} Created import log entry
   */
  async createImportLog(fileInfo) {
    try {
      const entry = await strapi.entityService.create('api::restaurant-import.restaurant-import', {
        data: {
          file_name: fileInfo.name,
          file_size: fileInfo.size.toString(),
          status: 'pending',
          log: `Import started at ${new Date().toISOString()}`,
          summary: {}
        }
      });
      
      return entry;
    } catch (error) {
      strapi.log.error('Error creating import log:', error);
      throw error;
    }
  },
  
  /**
   * Update an import log entry
   * @param {number} id - ID of the import log entry
   * @param {Object} data - Data to update
   * @returns {Object} Updated import log entry
   */
  async updateImportLog(id, data) {
    try {
      const entry = await strapi.entityService.update('api::restaurant-import.restaurant-import', id, {
        data
      });
      
      return entry;
    } catch (error) {
      strapi.log.error(`Error updating import log ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Mark an import as processing
   * @param {number} id - ID of the import log entry
   * @returns {Object} Updated import log entry
   */
  async markAsProcessing(id) {
    return this.updateImportLog(id, {
      status: 'processing',
      log: this.appendLog(id, 'Import processing started')
    });
  },
  
  /**
   * Mark an import as completed
   * @param {number} id - ID of the import log entry
   * @param {Object} result - Import result data
   * @returns {Object} Updated import log entry
   */
  async markAsCompleted(id, result) {
    // Create a summary of the import result
    const summary = {
      restaurant: result.restaurant ? { id: result.restaurant.id, name: result.restaurant.name } : null,
      menuCount: result.menus?.length || 0,
      menuItemCount: result.menuItems?.length || 0,
      cuisineCount: result.cuisines?.length || 0,
      subCuisineCount: result.subCuisines?.length || 0
    };
    
    return this.updateImportLog(id, {
      status: 'completed',
      processed_at: new Date(),
      imported_restaurant: result.restaurant ? result.restaurant.id : null,
      summary,
      log: this.appendLog(id, `Import completed successfully with ${summary.menuItemCount} menu items`)
    });
  },
  
  /**
   * Mark an import as failed
   * @param {number} id - ID of the import log entry
   * @param {Error} error - Error that caused the failure
   * @returns {Object} Updated import log entry
   */
  async markAsFailed(id, error) {
    return this.updateImportLog(id, {
      status: 'failed',
      processed_at: new Date(),
      error_details: {
        message: error.message,
        stack: error.stack
      },
      log: this.appendLog(id, `Import failed: ${error.message}`)
    });
  },
  
  /**
   * Append to the log of an import entry
   * @param {number} id - ID of the import log entry
   * @param {string} message - Message to append
   * @returns {string} Updated log text
   */
  async appendLog(id, message) {
    try {
      // Get the current log
      const entry = await strapi.entityService.findOne('api::restaurant-import.restaurant-import', id, {
        fields: ['log']
      });
      
      // Create the timestamp
      const timestamp = new Date().toISOString();
      
      // Append the message with timestamp
      let updatedLog = entry.log || '';
      if (updatedLog && !updatedLog.endsWith('\n')) {
        updatedLog += '\n';
      }
      updatedLog += `[${timestamp}] ${message}`;
      
      return updatedLog;
    } catch (error) {
      strapi.log.error(`Error appending to log ${id}:`, error);
      // Return the message anyway so the update can continue
      return `[${new Date().toISOString()}] ${message} (Error retrieving previous logs)`;
    }
  }
}; 