'use strict';

/**
 * Restaurant import controller
 */

const { sanitize } = require('@strapi/utils');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  /**
   * Upload restaurant data from Excel
   * @param {Object} ctx - Koa context
   */
  async upload(ctx) {
    let importLogId = null;
    
    try {
      // Extract services
      const { excelParser, validator, processor, logger } = strapi.api['restaurant-import'].services;
      
      // Get file from request
      const { file } = ctx.request.files || {};
      
      if (!file) {
        return ctx.badRequest('No file was uploaded');
      }
      
      // Check file type
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                     file.type === 'application/vnd.ms-excel';
      
      if (!isExcel) {
        return ctx.badRequest('Only Excel files are accepted');
      }
      
      // Create import log
      const importLog = await logger.createImportLog({
        name: file.name,
        size: file.size
      });
      
      importLogId = importLog.id;
      
      // Save file to temp directory
      const tmpFile = path.join(os.tmpdir(), `restaurant-import-${Date.now()}.xlsx`);
      fs.copyFileSync(file.path, tmpFile);
      
      // Update log status
      await logger.markAsProcessing(importLogId);
      
      // Parse Excel file
      const parsedData = await excelParser.parseExcel(tmpFile);
      await logger.updateImportLog(importLogId, {
        log: await logger.appendLog(importLogId, 'Excel file parsed successfully')
      });
      
      // Validate data
      const { isValid, errors } = await validator.validateExcelData(parsedData);
      
      if (!isValid) {
        await logger.markAsFailed(importLogId, new Error('Validation failed'));
        return ctx.badRequest('Validation failed', { errors });
      }
      
      await logger.updateImportLog(importLogId, {
        log: await logger.appendLog(importLogId, 'Data validation passed')
      });
      
      // Process data
      const result = await processor.processData(parsedData);
      
      // Clean up temp file
      fs.unlinkSync(tmpFile);
      
      if (result.success) {
        // Mark import as completed
        await logger.markAsCompleted(importLogId, result.results);
        
        // Return summary of import
        return {
          success: true,
          importId: importLogId,
          restaurant: sanitizeEntity(result.results.restaurant),
          summary: {
            menuCount: result.results.menus.length,
            menuItemCount: result.results.menuItems.length,
            cuisineCount: result.results.cuisines.length,
            subCuisineCount: result.results.subCuisines.length
          }
        };
      } else {
        // Mark import as failed
        await logger.markAsFailed(importLogId, new Error(result.error));
        
        return ctx.badRequest('Import processing failed', { 
          error: result.error,
          importId: importLogId
        });
      }
    } catch (error) {
      strapi.log.error('Error in restaurant import upload:', error);
      
      // Mark import as failed if log was created
      if (importLogId) {
        await strapi.api['restaurant-import'].services.logger.markAsFailed(importLogId, error);
      }
      
      return ctx.badRequest('Failed to process restaurant import', { 
        error: error.message,
        importId: importLogId
      });
    }
  },
  
  /**
   * Get import details
   * @param {Object} ctx - Koa context
   */
  async getImport(ctx) {
    try {
      const { id } = ctx.params;
      
      if (!id) {
        return ctx.badRequest('Import ID is required');
      }
      
      const importEntry = await strapi.entityService.findOne(
        'api::restaurant-import.restaurant-import', 
        id, 
        {
          populate: ['imported_restaurant']
        }
      );
      
      if (!importEntry) {
        return ctx.notFound('Import not found');
      }
      
      return {
        id: importEntry.id,
        status: importEntry.status,
        fileName: importEntry.file_name,
        fileSize: importEntry.file_size,
        processedAt: importEntry.processed_at,
        summary: importEntry.summary,
        restaurant: importEntry.imported_restaurant
          ? sanitizeEntity(importEntry.imported_restaurant)
          : null,
        log: importEntry.log,
        errorDetails: importEntry.error_details
      };
    } catch (error) {
      strapi.log.error('Error getting import details:', error);
      return ctx.badRequest('Failed to get import details', { error: error.message });
    }
  },
  
  /**
   * List imports
   * @param {Object} ctx - Koa context
   */
  async listImports(ctx) {
    try {
      const { page = 1, limit = 10 } = ctx.query;
      
      const [imports, count] = await Promise.all([
        strapi.entityService.findMany('api::restaurant-import.restaurant-import', {
          sort: { createdAt: 'DESC' },
          populate: ['imported_restaurant'],
          limit: parseInt(limit),
          start: (parseInt(page) - 1) * parseInt(limit)
        }),
        strapi.entityService.count('api::restaurant-import.restaurant-import', {})
      ]);
      
      return {
        data: imports.map(importEntry => ({
          id: importEntry.id,
          status: importEntry.status,
          fileName: importEntry.file_name,
          createdAt: importEntry.createdAt,
          processedAt: importEntry.processed_at,
          restaurant: importEntry.imported_restaurant
            ? { id: importEntry.imported_restaurant.id, name: importEntry.imported_restaurant.name }
            : null
        })),
        meta: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pageCount: Math.ceil(count / parseInt(limit))
        }
      };
    } catch (error) {
      strapi.log.error('Error listing imports:', error);
      return ctx.badRequest('Failed to list imports', { error: error.message });
    }
  },
  
  /**
   * Download Excel template
   * @param {Object} ctx - Koa context
   */
  async downloadTemplate(ctx) {
    try {
      // Extract template generator service
      const { templateGenerator } = strapi.api['restaurant-import'].services;
      
      // Generate template
      const template = await templateGenerator.generateTemplate();
      
      // Set headers for file download
      ctx.set('Content-disposition', `attachment; filename=${template.filename}`);
      ctx.set('Content-type', template.mimetype);
      
      // Stream file to response
      const fileStream = fs.createReadStream(template.path);
      return ctx.body = fileStream;
    } catch (error) {
      strapi.log.error('Error downloading template:', error);
      return ctx.badRequest('Failed to generate template', { error: error.message });
    }
  }
};

/**
 * Sanitize entity function to remove sensitive or unnecessary data
 * @param {Object} entity - Entity to sanitize
 * @returns {Object} Sanitized entity
 */
const sanitizeEntity = (entity) => {
  if (!entity) return null;
  
  const contentType = strapi.getModel(`api::${entity.__type || 'restaurant'}.${entity.__type || 'restaurant'}`);
  if (!contentType) return entity;
  
  return sanitize.contentAPI.output(entity, contentType);
}; 