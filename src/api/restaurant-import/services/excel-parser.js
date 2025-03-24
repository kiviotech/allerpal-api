'use strict';

const xlsx = require('xlsx');
const fs = require('fs');

/**
 * Excel parser service for restaurant import
 * Handles parsing Excel files and extracting structured data
 */
module.exports = {
  /**
   * Parse Excel file and return structured data
   * @param {string} filePath - Path to the uploaded Excel file
   * @returns {Object} Structured data from the Excel file
   */
  async parseExcel(filePath) {
    try {
      // Load workbook
      const workbook = xlsx.readFile(filePath);
      
      // Parse each worksheet
      const data = {
        restaurant: parseRestaurantSheet(workbook),
        menus: parseMenusSheet(workbook),
        menuItems: parseMenuItemsSheet(workbook),
        cuisines: parseCuisinesSheet(workbook),
        subCuisines: parseSubCuisinesSheet(workbook)
      };
      
      return data;
    } catch (error) {
      strapi.log.error('Error parsing Excel file:', error);
      throw new Error(`Error parsing Excel file: ${error.message}`);
    } finally {
      // Clean up the temp file
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        strapi.log.warn(`Failed to delete temp file ${filePath}:`, err);
      }
    }
  }
};

/**
 * Parse the Restaurant sheet
 * @param {Object} workbook - Excel workbook
 * @returns {Object} Restaurant data
 */
function parseRestaurantSheet(workbook) {
  const sheet = workbook.Sheets['Restaurant Info'];
  
  if (!sheet) {
    throw new Error('Restaurant Info sheet not found in Excel file');
  }
  
  // Convert sheet to JSON
  const rows = xlsx.utils.sheet_to_json(sheet);
  
  if (!rows.length) {
    throw new Error('Restaurant Info sheet is empty');
  }
  
  // Get the first row as restaurant data
  const restaurantData = rows[0];
  
  // Extract image data if present
  let imageData = null;
  if (restaurantData.ImageData) {
    imageData = parseBase64Image(restaurantData.ImageData);
    delete restaurantData.ImageData;
  }
  
  return {
    ...restaurantData,
    image: imageData
  };
}

/**
 * Parse the Menus sheet
 * @param {Object} workbook - Excel workbook
 * @returns {Array} Menu data
 */
function parseMenusSheet(workbook) {
  const sheet = workbook.Sheets['Menus'];
  
  if (!sheet) {
    throw new Error('Menus sheet not found in Excel file');
  }
  
  // Convert sheet to JSON
  const rows = xlsx.utils.sheet_to_json(sheet);
  
  if (!rows.length) {
    throw new Error('Menus sheet is empty');
  }
  
  return rows.map(row => ({
    type: row.Type?.toLowerCase() || 'normal',
    name: row.Name || `Menu ${row.ID || 'Unknown'}`
  }));
}

/**
 * Parse the Menu Items sheet
 * @param {Object} workbook - Excel workbook
 * @returns {Array} Menu items data
 */
function parseMenuItemsSheet(workbook) {
  const sheet = workbook.Sheets['Menu Items'];
  
  if (!sheet) {
    throw new Error('Menu Items sheet not found in Excel file');
  }
  
  // Convert sheet to JSON
  const rows = xlsx.utils.sheet_to_json(sheet);
  
  if (!rows.length) {
    throw new Error('Menu Items sheet is empty');
  }
  
  return rows.map(row => {
    // Extract image data if present
    let imageData = null;
    if (row.ImageData) {
      imageData = parseBase64Image(row.ImageData);
      delete row.ImageData;
    }
    
    // Parse allergens as array
    let allergens = [];
    if (row.Allergens) {
      allergens = row.Allergens.split(',').map(a => a.trim());
    }
    
    return {
      item_name: row.Name,
      description: row.Description,
      price: parseFloat(row.Price || 0),
      is_available: row.Available === 'Yes' || row.Available === true,
      is_vegetarian: row.Vegetarian === 'Yes' || row.Vegetarian === true,
      menuId: row.MenuID,
      cuisine: row.Cuisine,
      subCuisine: row.SubCuisine,
      allergens,
      image: imageData
    };
  });
}

/**
 * Parse the Cuisines sheet
 * @param {Object} workbook - Excel workbook
 * @returns {Array} Cuisine data
 */
function parseCuisinesSheet(workbook) {
  const sheet = workbook.Sheets['Cuisines'];
  
  if (!sheet) {
    strapi.log.warn('Cuisines sheet not found in Excel file');
    return [];
  }
  
  // Convert sheet to JSON
  const rows = xlsx.utils.sheet_to_json(sheet);
  
  if (!rows.length) {
    strapi.log.warn('Cuisines sheet is empty');
    return [];
  }
  
  return rows.map(row => {
    // Extract image data if present
    let imageData = null;
    if (row.ImageData) {
      imageData = parseBase64Image(row.ImageData);
      delete row.ImageData;
    }
    
    return {
      cuisine_type: row.Type,
      cuisine_description: row.Description,
      cuisine_image: imageData
    };
  });
}

/**
 * Parse the Sub-Cuisines sheet
 * @param {Object} workbook - Excel workbook
 * @returns {Array} Sub-cuisine data
 */
function parseSubCuisinesSheet(workbook) {
  const sheet = workbook.Sheets['Sub-Cuisines'];
  
  if (!sheet) {
    strapi.log.warn('Sub-Cuisines sheet not found in Excel file');
    return [];
  }
  
  // Convert sheet to JSON
  const rows = xlsx.utils.sheet_to_json(sheet);
  
  if (!rows.length) {
    strapi.log.warn('Sub-Cuisines sheet is empty');
    return [];
  }
  
  return rows.map(row => ({
    sub_cuisine_name: row.Name,
    parentCuisine: row.ParentCuisine
  }));
}

/**
 * Parse base64 image data
 * @param {string} base64String - Base64 encoded image data
 * @returns {Object} Parsed image data
 */
function parseBase64Image(base64String) {
  if (!base64String) return null;
  
  try {
    // Check if the string already has a data URI prefix
    if (!base64String.startsWith('data:')) {
      // Assume it's a JPEG if no prefix is provided
      base64String = `data:image/jpeg;base64,${base64String}`;
    }
    
    // Extract mime type and data
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image format');
    }
    
    return {
      mimeType: matches[1],
      data: matches[2]
    };
  } catch (error) {
    strapi.log.error('Error parsing base64 image:', error);
    return null;
  }
} 