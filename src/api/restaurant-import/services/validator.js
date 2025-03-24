'use strict';

/**
 * Validator service for restaurant import
 * Handles validation of Excel data before processing
 */
module.exports = {
  /**
   * Validate the Excel data
   * @param {Object} data - Data extracted from Excel
   * @returns {Object} Validation result
   */
  async validateExcelData(data) {
    const errors = [];
    
    // Validate restaurant data
    validateRestaurant(data.restaurant, errors);
    
    // Validate menus
    validateMenus(data.menus, errors);
    
    // Validate menu items
    validateMenuItems(data.menuItems, data.menus, errors);
    
    // Validate cuisines (optional)
    if (data.cuisines && data.cuisines.length) {
      validateCuisines(data.cuisines, errors);
    }
    
    // Validate sub-cuisines (optional)
    if (data.subCuisines && data.subCuisines.length) {
      validateSubCuisines(data.subCuisines, data.cuisines, errors);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

/**
 * Validate restaurant data
 * @param {Object} restaurant - Restaurant data
 * @param {Array} errors - Array to collect validation errors
 */
function validateRestaurant(restaurant, errors) {
  if (!restaurant) {
    errors.push({ field: 'restaurant', message: 'Restaurant data is required' });
    return;
  }
  
  // Required fields
  if (!restaurant.Name) {
    errors.push({ field: 'restaurant.Name', message: 'Restaurant name is required' });
  }
  
  if (!restaurant.Email) {
    errors.push({ field: 'restaurant.Email', message: 'Restaurant email is required' });
  } else if (!isValidEmail(restaurant.Email)) {
    errors.push({ field: 'restaurant.Email', message: 'Restaurant email is invalid' });
  }
  
  if (!restaurant.Location) {
    errors.push({ field: 'restaurant.Location', message: 'Restaurant location is required' });
  }
  
  // Optional fields with validation
  if (restaurant.ContactNumber && !isValidPhoneNumber(restaurant.ContactNumber)) {
    errors.push({ field: 'restaurant.ContactNumber', message: 'Restaurant contact number is invalid' });
  }
  
  if (restaurant.Rating && (isNaN(restaurant.Rating) || restaurant.Rating < 0 || restaurant.Rating > 5)) {
    errors.push({ field: 'restaurant.Rating', message: 'Restaurant rating must be a number between 0 and 5' });
  }
}

/**
 * Validate menus data
 * @param {Array} menus - Menus data
 * @param {Array} errors - Array to collect validation errors
 */
function validateMenus(menus, errors) {
  if (!menus || !Array.isArray(menus) || menus.length === 0) {
    errors.push({ field: 'menus', message: 'At least one menu is required' });
    return;
  }
  
  // Check for duplicate menu names
  const menuNames = new Set();
  
  menus.forEach((menu, index) => {
    // Required fields
    if (!menu.name) {
      errors.push({ field: `menus[${index}].name`, message: 'Menu name is required' });
    } else if (menuNames.has(menu.name)) {
      errors.push({ field: `menus[${index}].name`, message: `Duplicate menu name: ${menu.name}` });
    } else {
      menuNames.add(menu.name);
    }
    
    // Validate menu type
    if (menu.type && !['normal', 'allergen'].includes(menu.type.toLowerCase())) {
      errors.push({ field: `menus[${index}].type`, message: 'Menu type must be "normal" or "allergen"' });
    }
  });
}

/**
 * Validate menu items data
 * @param {Array} menuItems - Menu items data
 * @param {Array} menus - Menus data for reference
 * @param {Array} errors - Array to collect validation errors
 */
function validateMenuItems(menuItems, menus, errors) {
  if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
    errors.push({ field: 'menuItems', message: 'At least one menu item is required' });
    return;
  }
  
  // Get menu IDs for validation
  const menuIds = menus ? menus.map((menu, index) => menu.ID || `${index + 1}`) : [];
  
  menuItems.forEach((item, index) => {
    // Required fields
    if (!item.item_name) {
      errors.push({ field: `menuItems[${index}].item_name`, message: 'Menu item name is required' });
    }
    
    // Price validation
    if (isNaN(item.price)) {
      errors.push({ field: `menuItems[${index}].price`, message: 'Menu item price must be a number' });
    }
    
    // Menu ID validation
    if (item.menuId && menuIds.length > 0 && !menuIds.includes(item.menuId.toString())) {
      errors.push({ 
        field: `menuItems[${index}].menuId`, 
        message: `Menu ID ${item.menuId} does not exist in the Menus sheet` 
      });
    }
  });
}

/**
 * Validate cuisines data
 * @param {Array} cuisines - Cuisines data
 * @param {Array} errors - Array to collect validation errors
 */
function validateCuisines(cuisines, errors) {
  if (!Array.isArray(cuisines)) {
    errors.push({ field: 'cuisines', message: 'Cuisines must be an array' });
    return;
  }
  
  // Check for duplicate cuisine types
  const cuisineTypes = new Set();
  
  cuisines.forEach((cuisine, index) => {
    // Required fields
    if (!cuisine.cuisine_type) {
      errors.push({ field: `cuisines[${index}].cuisine_type`, message: 'Cuisine type is required' });
    } else if (cuisineTypes.has(cuisine.cuisine_type)) {
      errors.push({ field: `cuisines[${index}].cuisine_type`, message: `Duplicate cuisine type: ${cuisine.cuisine_type}` });
    } else {
      cuisineTypes.add(cuisine.cuisine_type);
    }
  });
}

/**
 * Validate sub-cuisines data
 * @param {Array} subCuisines - Sub-cuisines data
 * @param {Array} cuisines - Cuisines data for reference
 * @param {Array} errors - Array to collect validation errors
 */
function validateSubCuisines(subCuisines, cuisines, errors) {
  if (!Array.isArray(subCuisines)) {
    errors.push({ field: 'subCuisines', message: 'Sub-cuisines must be an array' });
    return;
  }
  
  // Get cuisine types for validation
  const cuisineTypes = cuisines ? cuisines.map(cuisine => cuisine.cuisine_type) : [];
  
  // Check for duplicate sub-cuisine names
  const subCuisineNames = new Set();
  
  subCuisines.forEach((subCuisine, index) => {
    // Required fields
    if (!subCuisine.sub_cuisine_name) {
      errors.push({ field: `subCuisines[${index}].sub_cuisine_name`, message: 'Sub-cuisine name is required' });
    } else if (subCuisineNames.has(subCuisine.sub_cuisine_name)) {
      errors.push({ 
        field: `subCuisines[${index}].sub_cuisine_name`, 
        message: `Duplicate sub-cuisine name: ${subCuisine.sub_cuisine_name}` 
      });
    } else {
      subCuisineNames.add(subCuisine.sub_cuisine_name);
    }
    
    // Parent cuisine validation
    if (subCuisine.parentCuisine && cuisineTypes.length > 0 && !cuisineTypes.includes(subCuisine.parentCuisine)) {
      errors.push({ 
        field: `subCuisines[${index}].parentCuisine`, 
        message: `Parent cuisine ${subCuisine.parentCuisine} does not exist in the Cuisines sheet` 
      });
    }
  });
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid phone number
 */
function isValidPhoneNumber(phone) {
  // Simple validation: at least 10 digits with optional country code and separators
  const phoneRegex = /^[+]?[\s./0-9-()]{10,}$/;
  return phoneRegex.test(phone);
} 