'use strict';

/**
 * Enhanced Processor service for restaurant import
 * Handles the creation of restaurants, menus, menu items, and allergens with improved error handling
 * and transaction support
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::restaurant-import.restaurant-import', ({ strapi }) => ({
  /**
   * Process JSON data with transaction support and enhanced error handling
   * @param {Object} data - The JSON data to process
   * @param {Object} options - Options for processing
   * @returns {Object} - Processing results
   */
  async processData(data, options = {}) {
    // Define startTime at the global scope of the function
    const startTime = Date.now();
    
    try {
      strapi.log.info(`[enhanced-processor] Starting processData with options: ${JSON.stringify(options)}`);
      strapi.log.info(`[enhanced-processor] Data type: ${typeof data}`);
      
      // Debug data structure
      if (data) {
        strapi.log.info(`[enhanced-processor] Data has restaurant: ${!!data.restaurant}`);
        strapi.log.info(`[enhanced-processor] Data has menus: ${!!data.menus && Array.isArray(data.menus)}`);
        strapi.log.info(`[enhanced-processor] Data has menuItems: ${!!data.menuItems && Array.isArray(data.menuItems)}`);
      } else {
        strapi.log.error(`[enhanced-processor] Data is null or undefined`);
      }
      
      const results = {
        restaurants: [],
        menus: [],
        allergens: [],
        menuItems: [],
        errors: [],
        warnings: [],
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        processingTimeMs: 0
      };

      // Start transaction with improved settings to avoid timeouts
      strapi.log.info(`[enhanced-processor] Starting database transaction`);
      let transaction;
      try {
        // Fix: Use the callback pattern for strapi.db.transaction
        transaction = await strapi.db.transaction(async (trx) => {
          // Return the transaction object
          return trx;
        });
        
        strapi.log.info(`[enhanced-processor] Transaction started successfully`);
      } catch (transactionError) {
        strapi.log.error(`[enhanced-processor] Failed to start transaction: ${transactionError.message}`);
        strapi.log.error(transactionError.stack);
        throw transactionError;
      }

      try {
        strapi.log.info('[enhanced-processor] Starting restaurant import transaction');

        // Process restaurants first
        if (data.restaurant) {
          strapi.log.info(`[enhanced-processor] Processing restaurant data: ${JSON.stringify(data.restaurant).substring(0, 100)}...`);
          
          try {
            // Validate restaurant data
            this.validateRestaurantData(data.restaurant);
            
            // Create or update restaurant
            const restaurant = await this.createOrUpdateRestaurant(
              data.restaurant,
              { transaction, updateExisting: options.updateExisting }
            );
            
            if (restaurant) {
              results.restaurants.push(restaurant);
              results.totalProcessed++;
              results.successCount++;
              
              // Process menus for this restaurant
              if (data.menus && Array.isArray(data.menus)) {
                strapi.log.info(`Processing ${data.menus.length} menus for restaurant ${restaurant.name}`);
                
                const menus = await this.createMenus(
                  data.menus,
                  restaurant.id,
                  { transaction, updateExisting: options.updateExisting }
                );
                
                results.menus.push(...menus);
                
                // Fetch allergens to reduce database calls
                const allergens = await strapi.entityService.findMany('api::allergy.allergy', {
                  transaction
                });
                results.allergens = allergens;
                
                // Process menu items in batches to avoid overwhelming the connection pool
                if (data.menuItems && Array.isArray(data.menuItems)) {
                  const totalMenuItems = data.menuItems.length;
                  strapi.log.info(`Processing ${totalMenuItems} menu items for restaurant ${restaurant.name} in batches`);
                  
                  // Process in batches of 10 items
                  const batchSize = 10;
                  const batches = Math.ceil(totalMenuItems / batchSize);
                  
                  for (let i = 0; i < batches; i++) {
                    const startIdx = i * batchSize;
                    const endIdx = Math.min(startIdx + batchSize, totalMenuItems);
                    const batchItems = data.menuItems.slice(startIdx, endIdx);
                    
                    strapi.log.info(`Processing batch ${i+1}/${batches} (${batchItems.length} items)`);
                    
                    // Use the Excel-specific function for processing
                    const menuItems = await this.createMenuItemsFromExcel(
                      batchItems,
                      restaurant.id,
                      results.menus,
                      results.allergens,
                      { transaction, updateExisting: options.updateExisting }
                    );
                    
                    results.menuItems.push(...menuItems);
                    
                    // Add a small delay between batches to prevent connection pool exhaustion
                    if (i < batches - 1) {
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }
                  }
                  
                  strapi.log.info(`Completed processing all menu items for restaurant ${restaurant.name}`);
                }
              }
            }
          } catch (restaurantError) {
            const errorMsg = `Error processing restaurant: ${restaurantError.message}`;
            strapi.log.error(`[enhanced-processor] ${errorMsg}`);
            strapi.log.error(restaurantError.stack);
            results.errors.push(errorMsg);
            results.failureCount++;
          }
        } else if (data.restaurants && Array.isArray(data.restaurants)) {
          strapi.log.info(`Processing ${data.restaurants.length} restaurants`);
          
          for (const restaurantData of data.restaurants) {
            try {
              // Validate restaurant data
              this.validateRestaurantJson(restaurantData);
              
              // Create or update restaurant
              const restaurant = await this.createRestaurantFromJson(
                restaurantData,
                { transaction, updateExisting: options.updateExisting }
              );
              
              if (restaurant) {
                results.restaurants.push(restaurant);
                results.totalProcessed++;
                results.successCount++;
                
                // Process menus for this restaurant
                if (restaurantData.menus && Array.isArray(restaurantData.menus)) {
                  strapi.log.info(`Processing ${restaurantData.menus.length} menus for restaurant ${restaurant.name}`);
                  
                  const menus = await this.createMenus(
                    restaurantData.menus,
                    restaurant.id,
                    { transaction, updateExisting: options.updateExisting }
                  );
                  
                  results.menus.push(...menus);
                  
                  // Fetch allergens to reduce database calls
                  const allergens = await strapi.entityService.findMany('api::allergy.allergy', {
                    transaction
                  });
                  results.allergens = allergens;
                  
                  // Process menu items in batches to avoid overwhelming the connection pool
                  if (restaurantData.menu_items && Array.isArray(restaurantData.menu_items)) {
                    const totalMenuItems = restaurantData.menu_items.length;
                    strapi.log.info(`Processing ${totalMenuItems} menu items for restaurant ${restaurant.name} in batches`);
                    
                    // Process in batches of 10 items
                    const batchSize = 10;
                    const batches = Math.ceil(totalMenuItems / batchSize);
                    
                    for (let i = 0; i < batches; i++) {
                      const startIdx = i * batchSize;
                      const endIdx = Math.min(startIdx + batchSize, totalMenuItems);
                      const batchItems = restaurantData.menu_items.slice(startIdx, endIdx);
                      
                      strapi.log.info(`Processing batch ${i+1}/${batches} (${batchItems.length} items)`);
                      
                      const menuItems = await this.createMenuItems(
                        batchItems,
                        restaurant.id,
                        results.menus,
                        results.allergens,
                        { transaction, updateExisting: options.updateExisting }
                      );
                      
                      results.menuItems.push(...menuItems);
                      
                      // Add a small delay between batches to prevent connection pool exhaustion
                      if (i < batches - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                      }
                    }
                    
                    strapi.log.info(`Completed processing all menu items for restaurant ${restaurant.name}`);
                  }
                }
              }
            } catch (err) {
              const errorMsg = `Error creating/updating restaurant: ${err.message}`;
              strapi.log.error(errorMsg);
              results.errors.push(errorMsg);
              results.failureCount++;
            }
          }
        } else {
          const errorMsg = 'No valid restaurant data found in import data';
          strapi.log.error(`[enhanced-processor] ${errorMsg}`);
          results.errors.push(errorMsg);
        }
        
        // Calculate total processing time
        results.processingTimeMs = Date.now() - startTime;
        
        // Commit the transaction if all went well
        strapi.log.info(`[enhanced-processor] Committing transaction`);
        try {
          await transaction.commit();
          strapi.log.info(`[enhanced-processor] Transaction committed successfully in ${results.processingTimeMs}ms`);
        } catch (commitError) {
          strapi.log.error(`[enhanced-processor] Error committing transaction: ${commitError.message}`);
          strapi.log.error(commitError.stack);
          throw commitError;
        }
        
        return results;
      } catch (error) {
        // Roll back the transaction if anything went wrong
        strapi.log.error(`[enhanced-processor] Error during processing, rolling back transaction: ${error.message}`);
        strapi.log.error(error.stack);
        
        try {
          await transaction.rollback();
          strapi.log.info(`[enhanced-processor] Transaction rolled back successfully`);
        } catch (rollbackError) {
          strapi.log.error(`[enhanced-processor] Error rolling back transaction: ${rollbackError.message}`);
          strapi.log.error(rollbackError.stack);
        }
        
        throw error;
      }
    } catch (err) {
      const errorMsg = `Error processing restaurant import data: ${err.message}`;
      strapi.log.error(`[enhanced-processor] ${errorMsg}`);
      strapi.log.error(err.stack);
      
      // Check if error is related to a callback function
      if (err.message.includes('not a function')) {
        strapi.log.error('[enhanced-processor] Detected function callback error. Tracing call stack:');
        try {
          // Log details about the error context
          strapi.log.error(`[enhanced-processor] Error name: ${err.name}`);
          strapi.log.error(`[enhanced-processor] Error type: ${typeof err}`);
          if (err.code) strapi.log.error(`[enhanced-processor] Error code: ${err.code}`);
          
          // Try to identify which function is causing the issue
          if (err.stack) {
            const stackLines = err.stack.split('\n').slice(1, 10);
            stackLines.forEach(line => {
              strapi.log.error(`[enhanced-processor] Stack trace: ${line.trim()}`);
            });
          }
        } catch (debugError) {
          strapi.log.error(`[enhanced-processor] Error while debugging the callback issue: ${debugError.message}`);
        }
      }
      
      return { 
        success: false, 
        error: errorMsg, 
        processingTimeMs: Date.now() - startTime,
        errors: [errorMsg],
        restaurants: [],
        menus: [],
        menuItems: [],
        allergens: []
      };
    }
  },

  /**
   * Validate restaurant data from Excel format
   * @param {Object} restaurantData - Restaurant data from Excel
   */
  validateRestaurantData(restaurantData) {
    if (!restaurantData) {
      throw new Error('Restaurant data is required');
    }
    
    if (!restaurantData.Name || !restaurantData.Email) {
      throw new Error('Restaurant data missing required fields (Name, Email)');
    }
    
    return true;
  },

  /**
   * Validate data without making any changes
   * @param {Object} data - The data to validate
   */
  async validateData(data) {
    // Validate restaurant data
    if (!data.restaurant || !data.restaurant.Name || !data.restaurant.Email) {
      throw new Error('Restaurant data missing required fields (Name, Email)');
    }
    
    // Validate menus data
    if (data.menus && !Array.isArray(data.menus)) {
      throw new Error('Menus must be an array');
    }
    
    // Validate menu items data
    if (data.menuItems) {
      if (!Array.isArray(data.menuItems)) {
        throw new Error('Menu items must be an array');
      }
      
      // Check each menu item for required fields
      for (const [index, item] of data.menuItems.entries()) {
        if (!item.item_name) {
          throw new Error(`Menu item at index ${index} is missing required field: item_name`);
        }
      }
    }
    
    // Validate allergens
    if (data.allergens) {
      if (!Array.isArray(data.allergens)) {
        throw new Error('Allergens must be an array');
      }
      
      // Check each allergen for required fields
      for (const [index, allergen] of data.allergens.entries()) {
        if (!allergen.name) {
          throw new Error(`Allergen at index ${index} is missing required field: name`);
        }
      }
    }
    
    return true;
  },

  /**
   * Process JSON data import
   * @param {Object} data - The JSON data to process
   * @param {Object} options - Import options
   * @returns {Object} Results of the import process
   */
  async processJsonData(data, options = {}) {
    const { dryRun = false, updateExisting = true, matchBy = 'email' } = options;
    
    const results = {
      restaurants: [],
      menus: [],
      menuItems: [],
      allergens: [],
      errors: [],
      warnings: [],
      processingTime: 0
    };

    const startTime = Date.now();

    try {
      if (!data || !data.data || !Array.isArray(data.data.restaurants)) {
        throw new Error('Invalid JSON data format. Expected { data: { restaurants: [] } }');
      }

      // Log the start of processing
      strapi.log.info(`Starting JSON restaurant import process${dryRun ? ' (dry run)' : ''}`);
      
      if (dryRun) {
        // Validate the data without making changes
        for (const restaurantData of data.data.restaurants) {
          await this.validateRestaurantJson(restaurantData);
        }
        
        results.processingTime = Date.now() - startTime;
        return { 
          success: true, 
          dryRun: true,
          results,
          message: 'JSON validation successful. No changes were made.'
        };
      }

      for (const restaurantData of data.data.restaurants) {
        try {
          // Each restaurant gets its own transaction for isolation
          const transaction = await strapi.db.transaction(async (trx) => {
            // Return the transaction object
            return trx;
          });
          
          try {
            // Create or update the restaurant
            const restaurant = await this.createRestaurantFromJson(
              restaurantData, 
              { transaction, updateExisting, matchBy }
            );

            if (!restaurant) throw new Error(`Failed to process restaurant: ${restaurantData.name}`);

            // Process menus
            const menus = await this.createMenusFromJson(
              restaurantData.menus || [
                { type: 'normal' },
                { type: 'allergen' }
              ],
              restaurant.id,
              { transaction, updateExisting }
            );

            // Add menus to results
            results.menus = [...results.menus, ...menus];

            // Process menu items and allergens
            if (Array.isArray(restaurantData.menuItems)) {
              for (const menuItemData of restaurantData.menuItems) {
                try {
                  // Process allergens first
                  const allergens = await this.processAllergensFromJson(
                    menuItemData.allergens || [],
                    { transaction, updateExisting }
                  );
                  
                  // Add processed allergens to results
                  const newAllergens = allergens.filter(
                    a => !results.allergens.some(existing => existing.id === a.id)
                  );
                  results.allergens = [...results.allergens, ...newAllergens];

                  // Create menu item with allergen associations
                  const menuType = menuItemData.menu_type || 'normal';
                  const matchingMenu = menus.find(m => m.type === menuType);
                  
                  if (!matchingMenu) {
                    results.warnings.push({
                      type: 'menu_item',
                      name: menuItemData.item_name,
                      message: `No menu found with type ${menuType}, using first available menu`
                    });
                  }

                  const menuItem = await this.createMenuItemFromJson(
                    menuItemData,
                    restaurant.id,
                    matchingMenu?.id || menus[0]?.id,
                    allergens.map(a => a.id),
                    { transaction, updateExisting }
                  );

                  if (menuItem) {
                    results.menuItems.push(menuItem);
                  }
                } catch (error) {
                  strapi.log.error(`Error processing menu item ${menuItemData.item_name}:`, error);
                  results.errors.push({
                    type: 'menu_item',
                    name: menuItemData.item_name,
                    error: error.message
                  });
                }
              }
            }

            // Commit the transaction if everything succeeded
            await transaction.commit();
            results.restaurants.push(restaurant);
            
          } catch (error) {
            // Rollback the transaction on error
            await transaction.rollback();
            throw error;
          }
        } catch (error) {
          strapi.log.error(`Error processing restaurant ${restaurantData.name}:`, error);
          results.errors.push({
            type: 'restaurant',
            name: restaurantData.name,
            error: error.message
          });
        }
      }

      results.processingTime = Date.now() - startTime;
      
      // Log successful completion
      strapi.log.info(`JSON restaurant import completed in ${results.processingTime}ms with ${results.errors.length} errors`);
      
      return {
        success: results.errors.length === 0,
        results,
        error: results.errors.length > 0 ? `${results.errors.length} errors occurred.` : null,
        message: `Import completed with ${results.restaurants.length} restaurants, ${results.menuItems.length} menu items, and ${results.allergens.length} allergens.`
      };
    } catch (error) {
      strapi.log.error('Error processing JSON restaurant import:', error);
      
      results.processingTime = Date.now() - startTime;
      
      return { 
        success: false, 
        error: error.message, 
        results,
        message: `JSON import failed: ${error.message}`
      };
    }
  },

  /**
   * Validate restaurant data in JSON format
   */
  async validateRestaurantJson(restaurantData) {
    if (!restaurantData.name || !restaurantData.email) {
      throw new Error('Restaurant missing required fields (name, email)');
    }
    
    // Validate menu items
    if (restaurantData.menuItems) {
      if (!Array.isArray(restaurantData.menuItems)) {
        throw new Error('menuItems must be an array');
      }
      
      for (const [index, item] of restaurantData.menuItems.entries()) {
        if (!item.item_name) {
          throw new Error(`Menu item at index ${index} is missing required field: item_name`);
        }
      }
    }
    
    return true;
  },

  /**
   * Create or update a restaurant from Excel data
   * @param {Object} restaurantData - Restaurant data from Excel
   * @param {Object} options - Import options
   * @returns {Object} - The created or updated restaurant
   */
  async createOrUpdateRestaurant(restaurantData, options = {}) {
    // This is just a wrapper for the createRestaurant function for Excel data
    return await this.createRestaurant(restaurantData, options);
  },

  /**
   * Create or update a restaurant
   */
  async createRestaurant(restaurantData, options = {}) {
    const { transaction, updateExisting = true } = options;
    
    try {
      const existingRestaurant = await strapi.db.query('api::restaurant.restaurant').findOne({
        where: { email: restaurantData.Email },
        populate: ['image'],
      });

      const restaurantEntry = {
        name: restaurantData.Name,
        email: restaurantData.Email,
        location: restaurantData.Location,
        description: restaurantData.Description,
        contact_number: restaurantData.ContactNumber,
        rating: restaurantData.Rating ? parseFloat(restaurantData.Rating) : undefined
      };

      if (restaurantData.Image) {
        const file = await this.uploadImage(
          restaurantData.Image, 
          `restaurant-${restaurantData.Name}`
        );
        if (file) {
          restaurantEntry.image = file.id;
        }
      }

      if (existingRestaurant && updateExisting) {
        strapi.log.info(`Updating existing restaurant: ${restaurantData.Name}`);
        return await strapi.entityService.update(
          'api::restaurant.restaurant',
          existingRestaurant.id,
          { 
            data: restaurantEntry,
            populate: ['image'],
            ...(transaction ? { transaction } : {})
          }
        );
      } else if (!existingRestaurant) {
        strapi.log.info(`Creating new restaurant: ${restaurantData.Name}`);
        return await strapi.entityService.create(
          'api::restaurant.restaurant',
          { 
            data: restaurantEntry,
            populate: ['image'],
            ...(transaction ? { transaction } : {})
          }
        );
      } else {
        strapi.log.info(`Skipping update for restaurant: ${restaurantData.Name} (updateExisting=false)`);
        return existingRestaurant;
      }
    } catch (error) {
      strapi.log.error('Error creating/updating restaurant:', error);
      throw new Error(`Failed to process restaurant: ${error.message}`);
    }
  },

  /**
   * Create or update a restaurant from JSON data
   */
  async createRestaurantFromJson(restaurantData, options = {}) {
    const { transaction, updateExisting = true, matchBy = 'email' } = options;
    
    try {
      let existingRestaurant = null;
      
      // Find existing restaurant based on matching strategy
      if (matchBy === 'email' && restaurantData.email) {
        existingRestaurant = await strapi.db.query('api::restaurant.restaurant').findOne({
          where: { email: restaurantData.email },
          populate: ['image'],
        });
      } else if (matchBy === 'name' && restaurantData.name) {
        existingRestaurant = await strapi.db.query('api::restaurant.restaurant').findOne({
          where: { name: restaurantData.name },
          populate: ['image'],
        });
      } else if (matchBy === 'id' && restaurantData.id) {
        existingRestaurant = await strapi.db.query('api::restaurant.restaurant').findOne({
          where: { id: restaurantData.id },
          populate: ['image'],
        });
      }

      const restaurantEntry = {
        name: restaurantData.name,
        email: restaurantData.email,
        location: restaurantData.location,
        description: restaurantData.description,
        contact_number: restaurantData.contact_number,
        rating: restaurantData.rating ? parseFloat(restaurantData.rating) : undefined
      };

      if (restaurantData.images && restaurantData.images.length > 0) {
        const file = await this.uploadImage(
          restaurantData.images[0].data, 
          `restaurant-${restaurantData.name}`
        );
        if (file) {
          restaurantEntry.image = file.id;
        }
      }

      if (existingRestaurant && updateExisting) {
        strapi.log.info(`Updating existing restaurant: ${restaurantData.name}`);
        return await strapi.entityService.update(
          'api::restaurant.restaurant',
          existingRestaurant.id,
          { 
            data: restaurantEntry,
            populate: ['image'],
            ...(transaction ? { transaction } : {})
          }
        );
      } else if (!existingRestaurant) {
        strapi.log.info(`Creating new restaurant: ${restaurantData.name}`);
        return await strapi.entityService.create(
          'api::restaurant.restaurant',
          { 
            data: restaurantEntry,
            populate: ['image'],
            ...(transaction ? { transaction } : {})
          }
        );
      } else {
        strapi.log.info(`Skipping update for restaurant: ${restaurantData.name} (updateExisting=false)`);
        return existingRestaurant;
      }
    } catch (error) {
      strapi.log.error('Error creating/updating restaurant from JSON:', error);
      throw new Error(`Failed to process restaurant: ${error.message}`);
    }
  },

  /**
   * Create default menus for a restaurant
   */
  async createDefaultMenus(restaurantId, options = {}) {
    const { transaction } = options;
    const defaultMenuTypes = ['normal', 'allergen'];
    const createdMenus = [];
    
    for (const type of defaultMenuTypes) {
      try {
        const menu = await strapi.entityService.create(
          'api::menu.menu', 
          {
            data: {
              type,
              restaurant: restaurantId
            },
            ...(transaction ? { transaction } : {})
          }
        );
        createdMenus.push(menu);
      } catch (error) {
        strapi.log.error(`Error creating default menu of type ${type}:`, error);
      }
    }
    
    return createdMenus;
  },

  /**
   * Create or update menus for a restaurant
   */
  async createMenus(menusData, restaurantId, options = {}) {
    const { transaction, updateExisting = true } = options;
    const createdMenus = [];

    for (const menuData of menusData) {
      try {
        const menuType = menuData.type || 'normal';
        
        const existingMenu = await strapi.db.query('api::menu.menu').findOne({
          where: { 
            restaurant: { id: restaurantId }, 
            type: menuType 
          }
        });

        const menuEntry = {
          type: menuType,
          restaurant: restaurantId
        };

        let menu;
        if (existingMenu && updateExisting) {
          menu = await strapi.entityService.update(
            'api::menu.menu',
            existingMenu.id,
            { 
              data: menuEntry,
              ...(transaction ? { transaction } : {})
            }
          );
        } else if (!existingMenu) {
          menu = await strapi.entityService.create(
            'api::menu.menu', 
            { 
              data: menuEntry,
              ...(transaction ? { transaction } : {})
            }
          );
        } else {
          menu = existingMenu;
        }

        createdMenus.push(menu);
      } catch (error) {
        strapi.log.error(`Error processing menu ${menuData.type}:`, error);
      }
    }

    return createdMenus;
  },

  /**
   * Create menus from JSON data
   */
  async createMenusFromJson(menusData, restaurantId, options = {}) {
    // If no menus provided, use defaults
    if (!menusData || !Array.isArray(menusData) || menusData.length === 0) {
      menusData = [{ type: 'normal' }, { type: 'allergen' }];
    }
    
    return await this.createMenus(menusData, restaurantId, options);
  },

  /**
   * Find or create allergens and return their IDs
   */
  async processAllergens(allergensData, options = {}) {
    const { transaction, updateExisting = true } = options;
    const processedAllergens = [];
    
    for (const allergenData of allergensData) {
      try {
        const allergenName = allergenData.name.trim();
        
        if (!allergenName) {
          continue;  // Skip empty allergen names
        }
        
        // Check if allergen already exists
        let allergen = await strapi.db.query('api::allergy.allergy').findOne({
          where: { 
            name: { $containsi: allergenName } 
          }
        });
        
        if (!allergen) {
          // Create new allergen
          allergen = await strapi.entityService.create(
            'api::allergy.allergy',
            {
              data: {
                name: allergenName,
                description: allergenData.description || '',
                is_custom: allergenData.is_custom || false,
                publishedAt: new Date()
              },
              ...(transaction ? { transaction } : {})
            }
          );
          strapi.log.info(`Created new allergen: ${allergenName}`);
        } else if (updateExisting) {
          // Update existing allergen if needed
          allergen = await strapi.entityService.update(
            'api::allergy.allergy',
            allergen.id,
            {
              data: {
                name: allergenName,
                description: allergenData.description || allergen.description || '',
                is_custom: allergenData.is_custom || allergen.is_custom || false
              },
              ...(transaction ? { transaction } : {})
            }
          );
          strapi.log.info(`Updated existing allergen: ${allergenName}`);
        }
        
        processedAllergens.push(allergen);
      } catch (error) {
        strapi.log.error(`Error processing allergen ${allergenData.name}:`, error);
      }
    }
    
    return processedAllergens;
  },

  /**
   * Process allergens from JSON data
   */
  async processAllergensFromJson(allergensData, options = {}) {
    if (!allergensData || !Array.isArray(allergensData)) {
      return [];
    }
    
    const formattedAllergens = allergensData.map(a => ({
      name: a.name || '',
      description: a.description || '',
      is_custom: a.is_custom || false
    }));
    
    return await this.processAllergens(formattedAllergens, options);
  },

  /**
   * Create menu items from Excel data format
   * Uses the common createMenuItems function with properly mapped data
   */
  async createMenuItemsFromExcel(menuItemsData, restaurantId, menus, allergens, options = {}) {
    // Map the menu items to the format expected by createMenuItems
    const mappedMenuItems = menuItemsData.map(item => ({
      item_name: item.Name,
      description: item.Description || '',
      price: item.Price,
      is_available: item.Available === 'true' || item.Available === true,
      is_vegetarian: item.Vegetarian === 'true' || item.Vegetarian === true,
      menu_type: item.MenuType?.toLowerCase() || 'normal',
      restaurant_email: item.RestaurantEmail,
      allergens: item.Allergens || '',
      image: item.ImageData || null
    }));
    
    return await this.createMenuItems(mappedMenuItems, restaurantId, menus, allergens, options);
  },

  /**
   * Create menu items from parsed data
   * @param {Array} menuItemsData - Menu item data from parsed Excel
   * @param {Number} restaurantId - Restaurant ID
   * @param {Array} menus - Available menus
   * @param {Array} allergens - Available allergens
   * @param {Object} options - Import options
   * @returns {Array} - Created menu items
   */
  async createMenuItems(menuItemsData, restaurantId, menus, allergens, options = {}) {
    const { transaction, updateExisting = true } = options;
    const createdMenuItems = [];
    const maxRetries = 3;

    // First, group the menu items by menu type to reduce database lookups
    const menuItemsByType = {};
    for (const itemData of menuItemsData) {
      const menuType = itemData.menu_type || 'normal';
      if (!menuItemsByType[menuType]) {
        menuItemsByType[menuType] = [];
      }
      menuItemsByType[menuType].push(itemData);
    }

    // First, get all allergen names to minimize lookups
    const allAllergenNames = new Set();
    for (const itemData of menuItemsData) {
      if (itemData.allergens && typeof itemData.allergens === 'string') {
        const allergenNames = itemData.allergens.split(',').map(a => a.trim()).filter(Boolean);
        allergenNames.forEach(name => allAllergenNames.add(name.toLowerCase()));
      }
    }

    // Then, get all existing allergens in a single query
    const allergenNameMap = {};
    for (const allergen of allergens) {
      allergenNameMap[allergen.name.toLowerCase()] = allergen;
    }

    // Process by menu type
    for (const [menuType, items] of Object.entries(menuItemsByType)) {
      // Find the correct menu for this type
      const targetMenu = menus.find(menu => menu.type === menuType);
      
      if (!targetMenu) {
        strapi.log.warn(`No menu found with type ${menuType}, skipping ${items.length} items`);
        continue;
      }

      // Process each menu item
      for (const itemData of items) {
        let retryCount = 0;
        let success = false;
        
        while (!success && retryCount < maxRetries) {
          try {
            const itemName = itemData.item_name || '';
            
            // Process allergens for this menu item - use the preloaded maps
            const itemAllergenIds = [];
            if (itemData.allergens && typeof itemData.allergens === 'string') {
              const allergenNames = itemData.allergens.split(',').map(a => a.trim()).filter(Boolean);
              
              for (const allergenName of allergenNames) {
                const lowerName = allergenName.toLowerCase();
                // Find allergen by name from our map
                const matchingAllergen = allergenNameMap[lowerName];
                
                if (matchingAllergen) {
                  itemAllergenIds.push(matchingAllergen.id);
                } else {
                  // Create new allergen if not found
                  try {
                    const newAllergen = await strapi.entityService.create(
                      'api::allergy.allergy',
                      {
                        data: {
                          name: allergenName,
                          is_custom: true,
                          publishedAt: new Date()
                        },
                        ...(transaction ? { transaction } : {})
                      }
                    );
                    
                    // Add to our maps for future lookups
                    allergens.push(newAllergen);
                    allergenNameMap[lowerName] = newAllergen;
                    
                    itemAllergenIds.push(newAllergen.id);
                    strapi.log.info(`Created new allergen for menu item: ${allergenName}`);
                  } catch (allergenError) {
                    strapi.log.error(`Error creating allergen ${allergenName}:`, allergenError);
                    // Continue without this allergen
                  }
                }
              }
            }
            
            // Check if menu item already exists - without populating relations to reduce DB load
            let existingItem;
            try {
              existingItem = await strapi.db.query('api::menu-item.menu-item').findOne({
                where: { 
                  item_name: itemName,
                  restaurant: { id: restaurantId }
                },
                // Only get essential fields, don't populate relations
                select: ['id', 'item_name']
              });
            } catch (queryError) {
              strapi.log.warn(`Error finding existing menu item ${itemName}, proceeding as new:`, queryError);
              existingItem = null;
            }
            
            const menuItemEntry = {
              item_name: itemName,
              description: itemData.description || '',
              price: itemData.price ? parseFloat(itemData.price) : undefined,
              is_available: itemData.is_available === 'true' || itemData.is_available === true,
              is_vegetarian: itemData.is_vegetarian === 'true' || itemData.is_vegetarian === true,
              menu: targetMenu.id,
              restaurant: restaurantId,
              allergens: itemAllergenIds,
              publishedAt: new Date() // Ensure the item is published
            };
    
            // Handle image upload - only if actually provided to reduce load
            if (itemData.image) {
              try {
                const file = await this.uploadImage(
                  itemData.image, 
                  `menu-item-${itemName}`
                );
                if (file) {
                  menuItemEntry.image = [file.id];
                }
              } catch (imageError) {
                strapi.log.warn(`Error uploading image for ${itemName}:`, imageError);
                // Continue without the image
              }
            }
    
            let menuItem;
            if (existingItem && updateExisting) {
              try {
                menuItem = await strapi.entityService.update(
                  'api::menu-item.menu-item',
                  existingItem.id,
                  { 
                    data: menuItemEntry,
                    ...(transaction ? { transaction } : {})
                  }
                );
                strapi.log.info(`Updated menu item: ${itemName} (ID: ${existingItem.id})`);
              } catch (updateError) {
                strapi.log.error(`Error updating menu item ${itemName}:`, updateError);
                throw updateError; // Propagate to retry logic
              }
            } else if (!existingItem) {
              try {
                menuItem = await strapi.entityService.create(
                  'api::menu-item.menu-item',
                  { 
                    data: menuItemEntry,
                    ...(transaction ? { transaction } : {})
                  }
                );
                strapi.log.info(`Created menu item: ${itemName}`);
              } catch (createError) {
                strapi.log.error(`Error creating menu item ${itemName}:`, createError);
                throw createError; // Propagate to retry logic
              }
            } else {
              menuItem = existingItem;
              strapi.log.info(`Skipping update for menu item: ${itemName} (updateExisting=false)`);
            }
    
            createdMenuItems.push(menuItem);
            success = true;
          } catch (error) {
            retryCount++;
            strapi.log.error(`Error processing menu item (attempt ${retryCount}/${maxRetries}):`, error);
            
            if (error.message && error.message.includes('Timeout acquiring a connection')) {
              strapi.log.info(`Connection pool timeout, waiting before retry...`);
              // Wait before retrying to allow connections to be released
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            } else if (retryCount >= maxRetries) {
              strapi.log.error(`Max retries exceeded for menu item, skipping`);
              break;
            }
          }
        }
      }
    }

    return createdMenuItems;
  },

  /**
   * Create menu item from JSON data
   */
  async createMenuItemFromJson(menuItemData, restaurantId, menuId, allergenIds, options = {}) {
    const { transaction, updateExisting = true } = options;
    
    try {
      const itemName = menuItemData.item_name || '';
      
      // Check if menu item already exists
      const existingItem = await strapi.db.query('api::menu-item.menu-item').findOne({
        where: { 
          item_name: itemName,
          restaurant: { id: restaurantId }
        },
        populate: ['allergens', 'image']
      });
      
      const menuItemEntry = {
        item_name: itemName,
        description: menuItemData.description || '',
        price: menuItemData.price ? parseFloat(menuItemData.price) : undefined,
        is_available: menuItemData.is_available === true,
        is_vegetarian: menuItemData.is_vegetarian === true,
        menu: menuId,
        restaurant: restaurantId,
        allergens: allergenIds
      };

      // Handle image upload
      if (menuItemData.images && menuItemData.images.length > 0) {
        const file = await this.uploadImage(
          menuItemData.images[0].data, 
          `menu-item-${itemName}`
        );
        if (file) {
          menuItemEntry.image = [file.id];
        }
      }

      let menuItem;
      if (existingItem && updateExisting) {
        menuItem = await strapi.entityService.update(
          'api::menu-item.menu-item',
          existingItem.id,
          { 
            data: menuItemEntry,
            populate: ['allergens', 'image'],
            ...(transaction ? { transaction } : {})
          }
        );
        strapi.log.info(`Updated menu item: ${itemName}`);
      } else if (!existingItem) {
        menuItem = await strapi.entityService.create(
          'api::menu-item.menu-item',
          { 
            data: menuItemEntry,
            populate: ['allergens', 'image'],
            ...(transaction ? { transaction } : {})
          }
        );
        strapi.log.info(`Created menu item: ${itemName}`);
      } else {
        menuItem = existingItem;
        strapi.log.info(`Skipping update for menu item: ${itemName} (updateExisting=false)`);
      }

      return menuItem;
    } catch (error) {
      strapi.log.error(`Error processing menu item ${menuItemData.item_name}:`, error);
      throw new Error(`Failed to process menu item: ${error.message}`);
    }
  },

  /**
   * Upload image from base64 data
   */
  async uploadImage(base64Data, fileName) {
    try {
      if (!base64Data) return null;

      // Check if the data is already a base64 string
      if (!base64Data.startsWith('data:')) {
        base64Data = `data:image/jpeg;base64,${base64Data}`;
      }

      // Extract the MIME type and base64 content
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 data format');
      }
      
      const mimeType = matches[1];
      const base64Content = matches[2];
      
      // Convert to buffer
      const buffer = Buffer.from(base64Content, 'base64');
      
      // Get extension from MIME type
      const extension = mimeType.split('/')[1] || 'jpg';
      const safeFileName = `${fileName.replace(/[^a-z0-9]/gi, '_')}.${extension}`;

      // Upload using Strapi upload provider
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {
          fileInfo: {
            name: safeFileName,
            type: mimeType,
          },
        },
        files: {
          path: buffer,
          name: safeFileName,
          type: mimeType,
          size: buffer.length,
        },
      });

      return uploadedFiles[0];
    } catch (error) {
      strapi.log.error('Error uploading image:', error);
      return null;
    }
  }
})); 