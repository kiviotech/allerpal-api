'use strict';

const { uploadFiles } = require('../../../services/strapi.js');
const { factories } = require('@strapi/strapi');
const fs = require('fs');
const path = require('path');
const process = require('process');

module.exports = factories.createCoreController('api::restaurant-import.restaurant-import', ({ strapi }) => ({
    async upload(ctx) {
        try {
            const { dryRun = false, updateExisting = true } = ctx.request.query;
            const files = ctx.request.files;
            
            if (!files || !files.file) {
                return ctx.badRequest('No file uploaded');
            }

            const file = files.file;
            
            // Check file type
            if (!file.type.includes('excel') && !file.type.includes('spreadsheet')) {
                return ctx.badRequest('Invalid file type. Please upload an Excel file.');
            }

            // Parse the Excel file
            const excelParser = strapi.service('api::restaurant-import.excel-parser');
            let parsedData;
            
            try {
                const buffer = fs.readFileSync(file.path);
                parsedData = await excelParser.parseExcel(buffer);
            } catch (error) {
                return ctx.badRequest(`Failed to parse Excel file: ${error.message}`);
            }
            
            // If there are warnings from parsing, include them in the response
            if (parsedData.warnings && parsedData.warnings.length > 0) {
                strapi.log.warn('Warnings during Excel parsing:', parsedData.warnings);
            }

            // Process the parsed data
            const enhancedProcessor = strapi.service('api::restaurant-import.enhanced-processor');
            const options = {
                dryRun: dryRun === 'true' || dryRun === true,
                updateExisting: updateExisting === 'true' || updateExisting === true
            };
            
            const result = await enhancedProcessor.processData(parsedData, options);

            // Create import record if not in dry run mode
            if (!options.dryRun && result.success) {
                await this.saveImportRecord({
                    type: 'excel',
                    source: file.name,
                    data: {
                        restaurant: result.results.restaurant?.id,
                        menuItems: result.results.menuItems?.map(item => item.id) || [],
                        menus: result.results.menus?.map(menu => menu.id) || [],
                        allergens: result.results.allergens?.map(allergen => allergen.id) || [],
                        importedAt: new Date()
                    }
                });
            }

            return {
                data: result.results,
                meta: {
                    success: result.success,
                    message: result.message,
                    dryRun: options.dryRun,
                    warnings: parsedData.warnings || [],
                    processingTime: result.results.processingTime
                }
            };
        } catch(error) {
            strapi.log.error('Error in restaurant import upload:', error);
            return ctx.badRequest(error.message);
        }
    },

    async importJson(ctx) {
        try {
            const { dryRun = false, updateExisting = true, matchBy = 'email' } = ctx.request.query;
            const data = ctx.request.body;
            
            if (!data) {
                return ctx.badRequest('No JSON data provided');
            }

            // Validate the basic structure
            if (!data.data || !data.data.restaurants || !Array.isArray(data.data.restaurants)) {
                return ctx.badRequest('Invalid JSON format. Expected { data: { restaurants: [] } }');
            }

            // Process the JSON data
            const enhancedProcessor = strapi.service('api::restaurant-import.enhanced-processor');
            const options = {
                dryRun: dryRun === 'true' || dryRun === true,
                updateExisting: updateExisting === 'true' || updateExisting === true,
                matchBy: matchBy || 'email'
            };
            
            const result = await enhancedProcessor.processJsonData(data, options);

            // Create import record if not in dry run mode
            if (!options.dryRun && result.success) {
                await this.saveImportRecord({
                    type: 'json',
                    source: 'API request',
                    data: {
                        restaurants: result.results.restaurants?.map(r => r.id) || [],
                        menuItems: result.results.menuItems?.map(item => item.id) || [],
                        allergens: result.results.allergens?.map(allergen => allergen.id) || [],
                        importedAt: new Date()
                    }
                });
            }

            return {
                data: result.results,
                meta: {
                    success: result.success,
                    message: result.message,
                    dryRun: options.dryRun,
                    errors: result.results.errors || [],
                    warnings: result.results.warnings || [],
                    processingTime: result.results.processingTime
                }
            };
        } catch (error) {
            strapi.log.error('Error in restaurant JSON import:', error);
            return ctx.badRequest(error.message);
        }
    },

    async downloadTemplate(ctx) {
        try {
            // Generate a fresh template using our excel parser service
            const excelParser = strapi.service('api::restaurant-import.excel-parser');
            const templateBuffer = await excelParser.generateTemplate();

            // Set appropriate headers for file download
            ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            ctx.set('Content-Disposition', 'attachment; filename=restaurant-import-template.xlsx');

            // Return the buffer as the response
            return templateBuffer;
        } catch (error) {
            strapi.log.error('Error generating template:', error);
            return ctx.badRequest(error.message);
        }
    },

    async getImport(ctx) {
        try {
            const { id } = ctx.params;
            
            if (!id) {
                return ctx.badRequest('Import ID is required');
            }

            // Fetch the import record
            const entity = await strapi.entityService.findOne(
                'api::restaurant-import.restaurant-import',
                id,
                {
                    populate: ['restaurant', 'menuItems']
                }
            );

            if (!entity) {
                return ctx.notFound('Import not found');
            }

            return {
                data: entity
            };
        } catch (error) {
            strapi.log.error('Error fetching import:', error);
            return ctx.badRequest(error.message);
        }
    },

    async listImports(ctx) {
        try {
            // Get query parameters for filtering, sorting, pagination
            const { _sort, _limit, _start, ...filters } = ctx.query;

            // Set up the query with populate parameter
            const query = {
                filters,
                sort: _sort,
                // Use string syntax for populate
                populate: '*'
            };

            // Add pagination if provided
            if (_limit) {
                query.pagination = {
                    limit: parseInt(_limit, 10),
                    start: parseInt(_start, 10) || 0
                };
            }

            // Fetch the import records
            const entities = await strapi.entityService.findMany(
                'api::restaurant-import.restaurant-import',
                query
            );

            // Get total count for pagination
            const count = await strapi.entityService.count(
                'api::restaurant-import.restaurant-import',
                { filters }
            );

            return {
                data: entities,
                meta: {
                    pagination: {
                        total: count,
                        page: _start ? Math.floor(_start / _limit) + 1 : 1,
                        pageSize: parseInt(_limit, 10) || 0,
                        pageCount: _limit ? Math.ceil(count / _limit) : 1
                    }
                }
            };
        } catch (error) {
            strapi.log.error('Error listing imports:', error);
            return ctx.badRequest(error.message);
        }
    },

    async create(ctx) {
        try {
            const {
                name,
                cuisine,
                rating,
                address,
                phone,
                menuItems,
                restaurantImages,
                ...rest
            } = ctx.request.body;

            // Process restaurant data
            const restaurantData = {
                name,
                cuisine,
                rating,
                address,
                phone,
                ...rest
            };

            // Create restaurant entry
            const restaurant = await strapi.entityService.create(
                'api::restaurant.restaurant',
                {
                    data: restaurantData
                }
            );

            // Process restaurant images
            if (restaurantImages && restaurantImages.length > 0) {
                await uploadFiles(restaurantImages, {
                    model: 'restaurant',
                    modelId: restaurant.id,
                    field: 'restaurantImages'
                });
            }

            // Process menu items
            if (menuItems && menuItems.length > 0) {
                for (const menuItem of menuItems) {
                    const {
                        name: menuItemName,
                        description,
                        price,
                        allergens,
                        menuItemImage,
                        ...menuItemRest
                    } = menuItem;

                    // Create menu item data
                    const menuItemData = {
                        name: menuItemName,
                        description,
                        price,
                        allergens,
                        restaurant: restaurant.id,
                        ...menuItemRest
                    };

                    // Create menu item entry
                    const menu_item = await strapi.entityService.create(
                        'api::menu-item.menu-item',
                        {
                            data: menuItemData
                        }
                    );

                    // Process menu item image
                    if (menuItemImage) {
                        await uploadFiles([menuItemImage], {
                            model: 'menu-item',
                            modelId: menu_item.id,
                            field: 'menuItemImage'
                        });
                    }
                }
            }

            return {
                data: {
                    message: 'Restaurant created successfully',
                    details: restaurant
                }
            };
        } catch (error) {
            ctx.response.status = 500;
            return {
                error: {
                    message: 'Error creating restaurant',
                    details: error.message
                }
            };
        }
    },

    /**
     * Save import record for tracking
     */
    async saveImportRecord(data) {
        try {
            return await strapi.entityService.create('api::restaurant-import.restaurant-import', {
                data: {
                    import_type: data.type,
                    source: data.source,
                    import_data: data.data,
                    publishedAt: new Date()
                }
            });
        } catch (error) {
            strapi.log.error('Error saving import record:', error);
            return null;
        }
    },

    /**
     * Validate data without importing
     */
    async validate(ctx) {
        try {
            const files = ctx.request.files;
            
            if (!files || !files.file) {
                return ctx.badRequest('No file uploaded');
            }

            const file = files.file;
            
            // Check file type
            if (!file.type.includes('excel') && !file.type.includes('spreadsheet')) {
                return ctx.badRequest('Invalid file type. Please upload an Excel file.');
            }

            // Parse the Excel file for validation only
            const excelParser = strapi.service('api::restaurant-import.excel-parser');
            let parsedData;
            
            try {
                const buffer = fs.readFileSync(file.path);
                parsedData = await excelParser.parseExcel(buffer);
            } catch (error) {
                return ctx.badRequest(`Failed to parse Excel file: ${error.message}`);
            }
            
            // Run validation through the processor without making changes
            const enhancedProcessor = strapi.service('api::restaurant-import.enhanced-processor');
            await enhancedProcessor.validateData(parsedData);
            
            return {
                data: {
                    valid: true,
                    restaurant: {
                        name: parsedData.restaurant.Name,
                        email: parsedData.restaurant.Email
                    },
                    counts: {
                        menus: parsedData.menus.length,
                        menuItems: parsedData.menuItems.length,
                        allergens: parsedData.allergens.length
                    }
                },
                meta: {
                    message: 'Data validation successful',
                    warnings: parsedData.warnings || []
                }
            };
        } catch (error) {
            strapi.log.error('Error validating import data:', error);
            return ctx.badRequest(error.message);
        }
    },

    /**
     * Process a file that has already been uploaded to the Strapi media library
     * @param {object} ctx - The context object containing the request
     * @returns {object} The processed import data
     */
    async processUploadedFile(ctx) {
        try {
            strapi.log.info(`[Controller:processUploadedFile] Starting process for uploaded file`);
            const { fileId, file_name } = ctx.request.body;
            
            strapi.log.info(`[Controller:processUploadedFile] Request body: fileId=${fileId}, file_name=${file_name}`);
            
            if (!fileId) {
                strapi.log.error(`[Controller:processUploadedFile] No fileId provided in request`);
                return ctx.badRequest('File ID is required');
            }
            
            if (!file_name) {
                strapi.log.error(`[Controller:processUploadedFile] No file_name provided in request`);
                return ctx.badRequest('file_name must be defined');
            }
            
            // Find the file in the media library
            strapi.log.info(`[Controller:processUploadedFile] Finding file in media library with ID ${fileId}`);
            let file;
            try {
                file = await strapi.plugins['upload'].services.upload.findOne(fileId);
                if (file) {
                    strapi.log.info(`[Controller:processUploadedFile] Found file: ${file.name}, mime: ${file.mime}, url: ${file.url}`);
                } else {
                    strapi.log.error(`[Controller:processUploadedFile] File with ID ${fileId} not found`);
                }
            } catch (findError) {
                strapi.log.error(`[Controller:processUploadedFile] Error finding file: ${findError.message}`);
                return ctx.badRequest(`Error finding file: ${findError.message}`);
            }
            
            if (!file) {
                return ctx.notFound(`File with ID ${fileId} not found`);
            }
            
            const { name, mime, url } = file;
            strapi.log.info(`[Controller:processUploadedFile] Processing uploaded file: ${name} (${mime}) from ${url}`);
            
            // Validate file type
            if (!mime.includes('excel') && !mime.includes('spreadsheet') && !mime.endsWith('csv')) {
                strapi.log.error(`[Controller:processUploadedFile] Invalid file type: ${mime}`);
                return ctx.badRequest('Only Excel spreadsheets or CSV files are supported');
            }
            
            // Create import record
            strapi.log.info(`[Controller:processUploadedFile] Creating import record`);
            let importRecord;
            try {
                importRecord = await strapi.entityService.create('api::restaurant-import.restaurant-import', {
                    data: {
                        name: `Import from ${file_name || name}`,
                        file: fileId,
                        status: 'pending',
                        created_at: new Date(),
                        file_name: file_name || name
                    }
                });
                strapi.log.info(`[Controller:processUploadedFile] Created import record with ID: ${importRecord.id}`);
            } catch (createError) {
                strapi.log.error(`[Controller:processUploadedFile] Error creating import record: ${createError.message}`);
                return ctx.badRequest(`Error creating import record: ${createError.message}`);
            }
            
            // Use the file parser service to parse the Excel file
            strapi.log.info(`[Controller:processUploadedFile] Getting file-parser service`);
            const fileParserService = strapi.service('api::restaurant-import.file-parser');
            
            if (!fileParserService) {
                strapi.log.error(`[Controller:processUploadedFile] file-parser service not found`);
                return ctx.badRequest('File parser service not available');
            }
            
            if (typeof fileParserService.parseFileFromUrl !== 'function') {
                strapi.log.error(`[Controller:processUploadedFile] fileParserService.parseFileFromUrl is not a function`);
                strapi.log.error(`[Controller:processUploadedFile] fileParserService type: ${typeof fileParserService}`);
                return ctx.badRequest('Invalid file parser service: parseFileFromUrl method not found');
            }
            
            strapi.log.info(`[Controller:processUploadedFile] Parsing file from URL: ${url}`);
            let fileData;
            try {
                fileData = await fileParserService.parseFileFromUrl(url);
                strapi.log.info(`[Controller:processUploadedFile] Successfully parsed file data`);
            } catch (parseError) {
                strapi.log.error(`[Controller:processUploadedFile] Error parsing file: ${parseError.message}`);
                
                // Update import record with error
                try {
                    await strapi.entityService.update('api::restaurant-import.restaurant-import', importRecord.id, {
                        data: {
                            status: 'failed',
                            errors: JSON.stringify([`Failed to parse file: ${parseError.message}`]),
                            completed_at: new Date()
                        }
                    });
                } catch (updateError) {
                    strapi.log.error(`[Controller:processUploadedFile] Error updating import record: ${updateError.message}`);
                }
                
                return ctx.badRequest(`Failed to parse file: ${parseError.message}`);
            }
            
            if (!fileData) {
                strapi.log.error(`[Controller:processUploadedFile] No data returned from parseFileFromUrl`);
                
                // Update import record with error
                try {
                    await strapi.entityService.update('api::restaurant-import.restaurant-import', importRecord.id, {
                        data: {
                            status: 'failed',
                            errors: JSON.stringify(['Failed to parse file data: No data returned']),
                            completed_at: new Date()
                        }
                    });
                } catch (updateError) {
                    strapi.log.error(`[Controller:processUploadedFile] Error updating import record: ${updateError.message}`);
                }
                
                return ctx.badRequest('Failed to parse file data');
            }
            
            // Update import status to processing
            strapi.log.info(`[Controller:processUploadedFile] Updating import record status to 'processing'`);
            try {
                await strapi.entityService.update('api::restaurant-import.restaurant-import', importRecord.id, {
                    data: {
                        status: 'processing',
                        started_at: new Date()
                    }
                });
            } catch (updateError) {
                strapi.log.error(`[Controller:processUploadedFile] Error updating import record: ${updateError.message}`);
            }
            
            // We'll return the import record to the client before processing in background
            const response = {
                data: {
                    import_id: importRecord.id,
                    file_name: file_name || name,
                    status: 'processing'
                },
                meta: {
                    message: 'File uploaded and processing started. Check import status for results.'
                }
            };
            
            // Process the data using a background job to prevent request timeout
            strapi.log.info(`[Controller:processUploadedFile] Starting background processing`);
            process.nextTick(async () => {
                try {
                    // Get the enhanced processor service for optimized handling
                    strapi.log.info(`[Controller:processUploadedFile:background] Getting enhanced-processor service`);
                    const enhancedProcessor = strapi.service('api::restaurant-import.enhanced-processor');
                    
                    if (!enhancedProcessor) {
                        throw new Error('Enhanced processor service not found');
                    }
                    
                    if (typeof enhancedProcessor.processData !== 'function') {
                        strapi.log.error(`[Controller:processUploadedFile:background] enhancedProcessor.processData is not a function`);
                        strapi.log.error(`[Controller:processUploadedFile:background] enhancedProcessor type: ${typeof enhancedProcessor}`);
                        throw new Error('enhancedProcessor.processData is not a function');
                    }
                    
                    strapi.log.info(`[Controller:processUploadedFile:background] Starting data processing`);
                    const startTime = Date.now();
                    
                    // Log fileData structure for debugging
                    strapi.log.info(`[Controller:processUploadedFile:background] fileData type: ${typeof fileData}`);
                    if (fileData) {
                        strapi.log.info(`[Controller:processUploadedFile:background] fileData has restaurant: ${!!fileData.restaurant}`);
                        strapi.log.info(`[Controller:processUploadedFile:background] fileData has menus: ${!!fileData.menus && Array.isArray(fileData.menus)}`);
                        strapi.log.info(`[Controller:processUploadedFile:background] fileData has menuItems: ${!!fileData.menuItems && Array.isArray(fileData.menuItems)}`);
                    }
                    
                    const results = await enhancedProcessor.processData(fileData, {
                        updateExisting: true
                    });
                    
                    // Calculate processing metrics
                    const processingTime = Date.now() - startTime;
                    const totalProcessed = results.restaurants ? results.restaurants.length : 0;
                    const totalMenuItems = results.menuItems ? results.menuItems.length : 0;
                    
                    strapi.log.info(`[Controller:processUploadedFile:background] Processing completed in ${processingTime}ms`);
                    strapi.log.info(`[Controller:processUploadedFile:background] Processed ${totalProcessed} restaurants and ${totalMenuItems} menu items`);
                    
                    // Update import record with results
                    strapi.log.info(`[Controller:processUploadedFile:background] Updating import record with results`);
                    await strapi.entityService.update('api::restaurant-import.restaurant-import', importRecord.id, {
                        data: {
                            status: results.errors && results.errors.length > 0 ? 'failed' : 'completed',
                            processing_time: processingTime,
                            results: JSON.stringify(results),
                            completed_at: new Date(),
                            restaurants_processed: totalProcessed,
                            menu_items_processed: totalMenuItems,
                            errors: results.errors && results.errors.length > 0 ? JSON.stringify(results.errors) : null
                        }
                    });
                    
                    strapi.log.info(`[Controller:processUploadedFile:background] Import completed for file ${name}`);
                } catch (processError) {
                    strapi.log.error(`[Controller:processUploadedFile:background] Error in background processing: ${processError.message}`);
                    strapi.log.error(processError.stack);
                    
                    // Try to identify the cause of 'cb is not a function' error
                    if (processError.message.includes('not a function')) {
                        strapi.log.error('[Controller:processUploadedFile:background] Detected callback error. Debugging:');
                        try {
                            // Log more details about the error context
                            strapi.log.error(`[Controller:processUploadedFile:background] Error name: ${processError.name}`);
                            strapi.log.error(`[Controller:processUploadedFile:background] Error type: ${typeof processError}`);
                            
                            // Log call stack
                            if (processError.stack) {
                                const stackLines = processError.stack.split('\n').slice(0, 10);
                                stackLines.forEach(line => {
                                    strapi.log.error(`[Controller:processUploadedFile:background] Stack: ${line.trim()}`);
                                });
                            }
                        } catch (debugError) {
                            strapi.log.error(`[Controller:processUploadedFile:background] Error during debugging: ${debugError.message}`);
                        }
                    }
                    
                    try {
                        // Update import record with error
                        await strapi.entityService.update('api::restaurant-import.restaurant-import', importRecord.id, {
                            data: {
                                status: 'failed',
                                errors: JSON.stringify([processError.message]),
                                completed_at: new Date()
                            }
                        });
                    } catch (updateError) {
                        strapi.log.error(`[Controller:processUploadedFile:background] Error updating import record: ${updateError.message}`);
                    }
                }
            });
            
            return response;
        } catch (error) {
            strapi.log.error(`[Controller:processUploadedFile] Unhandled error: ${error.message}`);
            strapi.log.error(error.stack);
            return ctx.badRequest(`Error processing uploaded file: ${error.message}`);
        }
    }
}));