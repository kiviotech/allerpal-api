'use strict';

/**
 * Processor service for restaurant import
 * Handles the creation of restaurants, menus, menu items, etc. from validated Excel data
 */
module.exports = {
  /**
   * Process the validated Excel data
   * @param {Object} data - Validated data extracted from Excel
   * @returns {Object} Results of the import process
   */
  async processData(data) {
    const results = {
      restaurant: null,
      menus: [],
      menuItems: [],
      cuisines: [],
      subCuisines: [],
      errors: []
    };
    
    try {
      // Create or update the restaurant
      results.restaurant = await createRestaurant(data.restaurant);
      
      // Create or update the menus
      if (data.menus && data.menus.length) {
        results.menus = await createMenus(data.menus, results.restaurant.id);
      }
      
      // Create or update the cuisines
      if (data.cuisines && data.cuisines.length) {
        results.cuisines = await createCuisines(data.cuisines, results.restaurant.id);
      }
      
      // Create or update the sub-cuisines
      if (data.subCuisines && data.subCuisines.length) {
        results.subCuisines = await createSubCuisines(data.subCuisines, results.cuisines);
      }
      
      // Create or update the menu items
      if (data.menuItems && data.menuItems.length) {
        results.menuItems = await createMenuItems(
          data.menuItems, 
          results.restaurant.id, 
          results.menus, 
          results.subCuisines
        );
      }
      
      return {
        success: true,
        results
      };
    } catch (error) {
      strapi.log.error('Error processing restaurant import data:', error);
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }
};

/**
 * Create or update a restaurant
 * @param {Object} restaurantData - Restaurant data from Excel
 * @returns {Object} Created or updated restaurant
 */
async function createRestaurant(restaurantData) {
  try {
    // Check if restaurant exists with the same email
    const existingRestaurant = await strapi.entityService.findMany('api::restaurant.restaurant', {
      filters: { email: restaurantData.Email }
    });
    
    // Prepare restaurant data
    const restaurantEntry = {
      name: restaurantData.Name,
      email: restaurantData.Email,
      location: restaurantData.Location,
      description: restaurantData.Description,
      contact_number: restaurantData.ContactNumber,
      rating: restaurantData.Rating ? parseFloat(restaurantData.Rating) : undefined
    };
    
    // Handle restaurant image upload
    if (restaurantData.Image) {
      const file = await uploadImage(restaurantData.Image, `restaurant-${restaurantData.Name}`);
      if (file) {
        restaurantEntry.image = file.id;
      }
    }
    
    // Create or update the restaurant
    if (existingRestaurant && existingRestaurant.length > 0) {
      // Update existing restaurant
      const updatedRestaurant = await strapi.entityService.update(
        'api::restaurant.restaurant', 
        existingRestaurant[0].id, 
        { data: restaurantEntry }
      );
      return updatedRestaurant;
    } else {
      // Create new restaurant
      const newRestaurant = await strapi.entityService.create(
        'api::restaurant.restaurant', 
        { data: restaurantEntry }
      );
      return newRestaurant;
    }
  } catch (error) {
    strapi.log.error('Error creating restaurant:', error);
    throw new Error(`Failed to create restaurant: ${error.message}`);
  }
}

/**
 * Create or update menus
 * @param {Array} menusData - Menus data from Excel
 * @param {number} restaurantId - ID of the restaurant to associate with
 * @returns {Array} Created or updated menus
 */
async function createMenus(menusData, restaurantId) {
  const createdMenus = [];
  
  for (const menuData of menusData) {
    try {
      // Check if menu exists with the same name for this restaurant
      const existingMenus = await strapi.entityService.findMany('api::menu.menu', {
        filters: { 
          restaurant: { id: restaurantId },
          type: menuData.name
        }
      });
      
      // Prepare menu data
      const menuEntry = {
        type: menuData.type || 'normal',
        restaurant: restaurantId
      };
      
      // Create or update the menu
      let menu;
      if (existingMenus && existingMenus.length > 0) {
        // Update existing menu
        menu = await strapi.entityService.update(
          'api::menu.menu', 
          existingMenus[0].id, 
          { data: menuEntry }
        );
      } else {
        // Create new menu
        menu = await strapi.entityService.create(
          'api::menu.menu', 
          { data: menuEntry }
        );
      }
      
      // Store original ID mapping for reference
      menu.originalId = menuData.ID || null;
      createdMenus.push(menu);
    } catch (error) {
      strapi.log.error(`Error creating menu "${menuData.name}":`, error);
      // Continue with other menus even if one fails
    }
  }
  
  return createdMenus;
}

/**
 * Create or update cuisines
 * @param {Array} cuisinesData - Cuisines data from Excel
 * @param {number} restaurantId - ID of the restaurant to associate with
 * @returns {Array} Created or updated cuisines
 */
async function createCuisines(cuisinesData, restaurantId) {
  const createdCuisines = [];
  
  for (const cuisineData of cuisinesData) {
    try {
      // Check if cuisine exists with the same type
      const existingCuisines = await strapi.entityService.findMany('api::cuisine.cuisine', {
        filters: { 
          cuisine_type: cuisineData.cuisine_type,
          restaurant: { id: restaurantId }
        }
      });
      
      // Prepare cuisine data
      const cuisineEntry = {
        cuisine_type: cuisineData.cuisine_type,
        cuisine_description: cuisineData.cuisine_description,
        restaurant: restaurantId
      };
      
      // Handle cuisine image upload
      if (cuisineData.cuisine_image) {
        const file = await uploadImage(cuisineData.cuisine_image, `cuisine-${cuisineData.cuisine_type}`);
        if (file) {
          cuisineEntry.cuisine_image = file.id;
        }
      }
      
      // Create or update the cuisine
      let cuisine;
      if (existingCuisines && existingCuisines.length > 0) {
        // Update existing cuisine
        cuisine = await strapi.entityService.update(
          'api::cuisine.cuisine', 
          existingCuisines[0].id, 
          { data: cuisineEntry }
        );
      } else {
        // Create new cuisine
        cuisine = await strapi.entityService.create(
          'api::cuisine.cuisine', 
          { data: cuisineEntry }
        );
      }
      
      // Store original type for reference
      cuisine.originalType = cuisineData.cuisine_type;
      createdCuisines.push(cuisine);
    } catch (error) {
      strapi.log.error(`Error creating cuisine "${cuisineData.cuisine_type}":`, error);
      // Continue with other cuisines even if one fails
    }
  }
  
  return createdCuisines;
}

/**
 * Create or update sub-cuisines
 * @param {Array} subCuisinesData - Sub-cuisines data from Excel
 * @param {Array} cuisines - Created cuisines for reference
 * @returns {Array} Created or updated sub-cuisines
 */
async function createSubCuisines(subCuisinesData, cuisines) {
  const createdSubCuisines = [];
  
  for (const subCuisineData of subCuisinesData) {
    try {
      // Find parent cuisine ID
      const parentCuisine = cuisines.find(cuisine => cuisine.originalType === subCuisineData.parentCuisine);
      
      if (!parentCuisine) {
        strapi.log.warn(`Parent cuisine "${subCuisineData.parentCuisine}" not found for sub-cuisine "${subCuisineData.sub_cuisine_name}"`);
        continue;
      }
      
      // Check if sub-cuisine exists with the same name
      const existingSubCuisines = await strapi.entityService.findMany('api::sub-cuisine.sub-cuisine', {
        filters: { 
          sub_cuisine_name: subCuisineData.sub_cuisine_name,
          cuisine: { id: parentCuisine.id }
        }
      });
      
      // Prepare sub-cuisine data
      const subCuisineEntry = {
        sub_cuisine_name: subCuisineData.sub_cuisine_name,
        cuisine: parentCuisine.id
      };
      
      // Create or update the sub-cuisine
      let subCuisine;
      if (existingSubCuisines && existingSubCuisines.length > 0) {
        // Update existing sub-cuisine
        subCuisine = await strapi.entityService.update(
          'api::sub-cuisine.sub-cuisine', 
          existingSubCuisines[0].id, 
          { data: subCuisineEntry }
        );
      } else {
        // Create new sub-cuisine
        subCuisine = await strapi.entityService.create(
          'api::sub-cuisine.sub-cuisine', 
          { data: subCuisineEntry }
        );
      }
      
      // Store original name for reference
      subCuisine.originalName = subCuisineData.sub_cuisine_name;
      createdSubCuisines.push(subCuisine);
    } catch (error) {
      strapi.log.error(`Error creating sub-cuisine "${subCuisineData.sub_cuisine_name}":`, error);
      // Continue with other sub-cuisines even if one fails
    }
  }
  
  return createdSubCuisines;
}

/**
 * Create or update menu items
 * @param {Array} menuItemsData - Menu items data from Excel
 * @param {number} restaurantId - ID of the restaurant to associate with
 * @param {Array} menus - Created menus for reference
 * @param {Array} subCuisines - Created sub-cuisines for reference
 * @returns {Array} Created or updated menu items
 */
async function createMenuItems(menuItemsData, restaurantId, menus, subCuisines) {
  const createdMenuItems = [];
  
  for (const menuItemData of menuItemsData) {
    try {
      // Find menu by original ID
      const menu = menuItemData.menuId 
        ? menus.find(m => m.originalId === menuItemData.menuId.toString())
        : menus[0]; // Use first menu if not specified
      
      if (!menu) {
        strapi.log.warn(`Menu ID "${menuItemData.menuId}" not found for menu item "${menuItemData.item_name}"`);
        continue;
      }
      
      // Find sub-cuisine if specified
      let subCuisineId = null;
      if (menuItemData.subCuisine) {
        const subCuisine = subCuisines.find(sc => sc.originalName === menuItemData.subCuisine);
        if (subCuisine) {
          subCuisineId = subCuisine.id;
        }
      }
      
      // Check if item exists with the same name in the same menu
      const existingMenuItems = await strapi.entityService.findMany('api::menu-item.menu-item', {
        filters: { 
          item_name: menuItemData.item_name,
          menu: { id: menu.id },
          restaurant: { id: restaurantId }
        }
      });
      
      // Prepare menu item data
      const menuItemEntry = {
        item_name: menuItemData.item_name,
        description: menuItemData.description,
        price: parseFloat(menuItemData.price) || 0,
        is_available: menuItemData.is_available === true || menuItemData.is_available === 'true',
        is_vegetarian: menuItemData.is_vegetarian === true || menuItemData.is_vegetarian === 'true',
        menu: menu.id,
        restaurant: restaurantId
      };
      
      // Add sub-cuisine if available
      if (subCuisineId) {
        menuItemEntry.sub_cuisine = subCuisineId;
      }
      
      // Handle allergens if available
      if (menuItemData.allergens && Array.isArray(menuItemData.allergens) && menuItemData.allergens.length > 0) {
        // Find or create allergens
        const allergenIds = await processAllergens(menuItemData.allergens);
        if (allergenIds.length > 0) {
          menuItemEntry.allergens = allergenIds;
        }
      }
      
      // Handle menu item image upload
      if (menuItemData.image) {
        const file = await uploadImage(menuItemData.image, `menu-item-${menuItemData.item_name}`);
        if (file) {
          menuItemEntry.image = file.id;
        }
      }
      
      // Create or update the menu item
      let menuItem;
      if (existingMenuItems && existingMenuItems.length > 0) {
        // Update existing menu item
        menuItem = await strapi.entityService.update(
          'api::menu-item.menu-item', 
          existingMenuItems[0].id, 
          { data: menuItemEntry }
        );
      } else {
        // Create new menu item
        menuItem = await strapi.entityService.create(
          'api::menu-item.menu-item', 
          { data: menuItemEntry }
        );
      }
      
      createdMenuItems.push(menuItem);
    } catch (error) {
      strapi.log.error(`Error creating menu item "${menuItemData.item_name}":`, error);
      // Continue with other menu items even if one fails
    }
  }
  
  return createdMenuItems;
}

/**
 * Process allergens - find existing ones or create new ones
 * @param {Array} allergenNames - Array of allergen names
 * @returns {Array} Array of allergen IDs
 */
async function processAllergens(allergenNames) {
  const allergenIds = [];
  
  for (const allergenName of allergenNames) {
    try {
      // Check if allergen exists
      const existingAllergens = await strapi.entityService.findMany('api::allergy.allergy', {
        filters: { name: allergenName }
      });
      
      if (existingAllergens && existingAllergens.length > 0) {
        // Use existing allergen
        allergenIds.push(existingAllergens[0].id);
      } else {
        // Create new allergen
        const newAllergen = await strapi.entityService.create('api::allergy.allergy', {
          data: {
            name: allergenName,
            is_custom: true
          }
        });
        allergenIds.push(newAllergen.id);
      }
    } catch (error) {
      strapi.log.error(`Error processing allergen "${allergenName}":`, error);
      // Continue with other allergens even if one fails
    }
  }
  
  return allergenIds;
}

/**
 * Upload an image from base64 or URL
 * @param {string} imageData - Base64 string or URL of the image
 * @param {string} fileName - Name to use for the file
 * @returns {Object} Uploaded file object
 */
async function uploadImage(imageData, fileName) {
  try {
    // Check if imageData is base64
    if (imageData.startsWith('data:image')) {
      // Handle base64 image
      const base64Data = imageData.split(';base64,').pop();
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = imageData.split(';')[0].split(':')[1];
      const extension = mimeType.split('/')[1];
      const safeFileName = `${fileName.replace(/[^a-zA-Z0-9]/g, '-')}.${extension}`;
      
      // Create file entity using Strapi's upload provider
      const file = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: {
          path: null,
          name: safeFileName,
          type: mimeType,
          size: buffer.length,
          buffer
        }
      });
      
      return Array.isArray(file) ? file[0] : file;
    } else if (imageData.startsWith('http')) {
      // Handle URL image
      const response = await fetch(imageData);
      const buffer = await response.buffer();
      const contentType = response.headers.get('content-type');
      const extension = contentType ? contentType.split('/')[1] : 'jpg';
      const safeFileName = `${fileName.replace(/[^a-zA-Z0-9]/g, '-')}.${extension}`;
      
      // Create file entity using Strapi's upload provider
      const file = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: {
          path: null,
          name: safeFileName,
          type: contentType,
          size: buffer.length,
          buffer
        }
      });
      
      return Array.isArray(file) ? file[0] : file;
    } else {
      strapi.log.warn(`Invalid image format for ${fileName}`);
      return null;
    }
  } catch (error) {
    strapi.log.error(`Error uploading image for ${fileName}:`, error);
    return null;
  }
} 