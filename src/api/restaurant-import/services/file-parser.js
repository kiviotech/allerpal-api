'use strict';

/**
 * File parser service for restaurant import
 * Handles parsing of files that have been uploaded to the Strapi media library
 */

const axios = require('axios');
const xlsx = require('xlsx');
const { createCoreService } = require('@strapi/strapi').factories;

// Base URL for media server
const MEDIA_URL = "http://localhost:1402";

module.exports = createCoreService('api::restaurant-import.restaurant-import', ({ strapi }) => ({
  /**
   * Parse an Excel file from a URL
   * @param {string} url - URL of the file in Strapi media library
   * @returns {Object} Parsed data
   */
  async parseFileFromUrl(url) {
    try {
      strapi.log.info(`[parseFileFromUrl] Parsing file from URL: ${url}`);
      
      // Determine if the URL is absolute or relative
      const fileUrl = url.startsWith('http') ? url : `${MEDIA_URL}${url}`;
      strapi.log.info(`[parseFileFromUrl] Full file URL: ${fileUrl}`);
      
      // Fetch the file data from the URL
      strapi.log.info(`[parseFileFromUrl] Fetching file data with axios`);
      let response;
      try {
        response = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
        });
        strapi.log.info(`[parseFileFromUrl] Successfully fetched file data, status: ${response.status}`);
      } catch (axiosError) {
        strapi.log.error(`[parseFileFromUrl] Axios error: ${axiosError.message}`);
        if (axiosError.response) {
          strapi.log.error(`[parseFileFromUrl] Axios response status: ${axiosError.response.status}`);
        }
        throw axiosError;
      }

      if (!response.data) {
        strapi.log.error('[parseFileFromUrl] No data in response');
        throw new Error('Failed to download file from URL');
      }
      
      // Use the Excel parser service to parse the file
      strapi.log.info(`[parseFileFromUrl] Getting excel-parser service`);
      const excelParser = strapi.service('api::restaurant-import.excel-parser');
      
      if (!excelParser) {
        strapi.log.error('[parseFileFromUrl] excel-parser service not found');
        throw new Error('Excel parser service not found');
      }
      
      strapi.log.info(`[parseFileFromUrl] Creating buffer from response data`);
      const buffer = Buffer.from(response.data);
      
      strapi.log.info(`[parseFileFromUrl] Calling excelParser.parseExcel with buffer of size: ${buffer.length}`);
      let parsedData;
      try {
        parsedData = await excelParser.parseExcel(buffer);
        strapi.log.info(`[parseFileFromUrl] Successfully parsed Excel data`);
      } catch (parseError) {
        strapi.log.error(`[parseFileFromUrl] Excel parsing error: ${parseError.message}`);
        throw parseError;
      }
      
      return parsedData;
    } catch (error) {
      strapi.log.error(`[parseFileFromUrl] Error parsing file from URL: ${error.message}`);
      strapi.log.error(error.stack);
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  },
  
  /**
   * Process file that has been uploaded to Strapi media library
   * @param {number} fileId - ID of the file in Strapi media library
   * @returns {Object} Processing result
   */
  async processUploadedFile(fileId) {
    try {
      strapi.log.info(`[processUploadedFile] Starting to process file ID: ${fileId}`);
      
      if (!fileId) {
        strapi.log.error('[processUploadedFile] No fileId provided');
        throw new Error('File ID is required');
      }
      
      // Find the file in the media library
      strapi.log.info(`[processUploadedFile] Looking up file in media library`);
      let file;
      try {
        file = await strapi.plugins['upload'].services.upload.findOne(fileId);
        strapi.log.info(`[processUploadedFile] Found file: ${file ? file.name : 'undefined'}`);
      } catch (findError) {
        strapi.log.error(`[processUploadedFile] Error finding file: ${findError.message}`);
        throw findError;
      }
      
      if (!file) {
        strapi.log.error(`[processUploadedFile] File with ID ${fileId} not found`);
        throw new Error(`File with ID ${fileId} not found`);
      }
      
      const { url } = file;
      strapi.log.info(`[processUploadedFile] File URL: ${url}`);
      
      // Parse the file data
      strapi.log.info(`[processUploadedFile] Calling parseFileFromUrl`);
      let fileData;
      try {
        fileData = await this.parseFileFromUrl(url);
        strapi.log.info(`[processUploadedFile] Successfully parsed file data`);
      } catch (parseError) {
        strapi.log.error(`[processUploadedFile] Error parsing file: ${parseError.message}`);
        throw parseError;
      }
      
      if (!fileData) {
        strapi.log.error('[processUploadedFile] No data returned from parseFileFromUrl');
        throw new Error('Failed to parse file data');
      }
      
      // Process the parsed data using enhanced processor
      strapi.log.info(`[processUploadedFile] Getting enhanced-processor service`);
      const enhancedProcessor = strapi.service('api::restaurant-import.enhanced-processor');
      
      if (!enhancedProcessor) {
        strapi.log.error('[processUploadedFile] enhanced-processor service not found');
        throw new Error('Enhanced processor service not found');
      }
      
      if (typeof enhancedProcessor.processData !== 'function') {
        strapi.log.error('[processUploadedFile] enhancedProcessor.processData is not a function');
        strapi.log.error(`[processUploadedFile] enhancedProcessor type: ${typeof enhancedProcessor}`);
        strapi.log.error(`[processUploadedFile] enhancedProcessor.processData type: ${typeof enhancedProcessor.processData}`);
        throw new Error('enhancedProcessor.processData is not a function');
      }
      
      strapi.log.info(`[processUploadedFile] Calling enhancedProcessor.processData`);
      let result;
      try {
        result = await enhancedProcessor.processData(fileData, {
          updateExisting: true
        });
        strapi.log.info(`[processUploadedFile] Successfully processed data`);
      } catch (processError) {
        strapi.log.error(`[processUploadedFile] Error processing data: ${processError.message}`);
        strapi.log.error(processError.stack);
        throw processError;
      }
      
      return result;
    } catch (error) {
      strapi.log.error(`[processUploadedFile] Error processing uploaded file: ${error.message}`);
      strapi.log.error(error.stack);
      throw error;
    }
  }
})); 