// Test script for restaurant import processing
'use strict';

module.exports = {
  async testProcessImport(ctx) {
    try {
      const { id } = ctx.params;
      const { strapi } = ctx;
      
      // Fail early if no ID provided
      if (!id) {
        return ctx.badRequest('Import ID is required');
      }
      
      strapi.log.info(`Starting test import processing for ID: ${id}`);
      
      // Find the import record
      const importRecord = await strapi.db.query('api::restaurant-import.restaurant-import').findOne({
        where: { id },
        populate: ['file']
      });
      
      if (!importRecord) {
        return ctx.notFound(`Import with ID ${id} not found`);
      }
      
      // Check if file exists
      if (!importRecord.file) {
        return ctx.badRequest(`No file found for import ID ${id}`);
      }
      
      // Get the enhanced processor service
      const enhancedProcessor = strapi.service('api::restaurant-import.enhanced-processor');
      if (!enhancedProcessor) {
        return ctx.badRequest('Enhanced processor service not available');
      }
      
      // Get file parser service
      const fileParserService = strapi.service('api::restaurant-import.file-parser');
      if (!fileParserService) {
        return ctx.badRequest('File parser service not available');
      }
      
      // Read and parse the file
      const fileUrl = importRecord.file.url;
      strapi.log.info(`Processing import file: ${fileUrl}`);
      
      const fileData = await fileParserService.parseFileFromUrl(fileUrl);
      
      if (!fileData) {
        return ctx.badRequest('Failed to parse file data');
      }
      
      // Update import status to processing
      await strapi.entityService.update('api::restaurant-import.restaurant-import', id, {
        data: {
          status: 'processing',
          started_at: new Date()
        }
      });
      
      // Process with enhanced processor
      const startTime = Date.now();
      const results = await enhancedProcessor.processData(fileData, {
        updateExisting: true
      });
      
      // Calculate processing metrics
      const processingTime = Date.now() - startTime;
      const totalProcessed = results.restaurants.length;
      const totalMenuItems = results.menuItems.length;
      
      // Update import record with results
      await strapi.entityService.update('api::restaurant-import.restaurant-import', id, {
        data: {
          status: results.errors.length > 0 ? 'failed' : 'completed',
          processing_time: processingTime,
          results: JSON.stringify(results),
          completed_at: new Date(),
          restaurants_processed: totalProcessed,
          menu_items_processed: totalMenuItems,
          errors: results.errors.length > 0 ? JSON.stringify(results.errors) : null
        }
      });
      
      return {
        success: results.errors.length === 0,
        processing_time_ms: processingTime,
        total_processed: totalProcessed,
        menu_items_processed: totalMenuItems,
        errors: results.errors,
        warnings: results.warnings
      };
    } catch (error) {
      strapi.log.error('Error testing import processing:', error);
      
      // Update import record to failed status
      if (ctx.params.id) {
        try {
          await strapi.entityService.update('api::restaurant-import.restaurant-import', ctx.params.id, {
            data: {
              status: 'failed',
              errors: JSON.stringify([error.message]),
              completed_at: new Date()
            }
          });
        } catch (updateError) {
          strapi.log.error('Error updating import record:', updateError);
        }
      }
      
      return ctx.badRequest(`Error testing import: ${error.message}`);
    }
  }
}; 