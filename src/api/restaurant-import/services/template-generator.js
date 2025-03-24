'use strict';

/**
 * Template generator service for restaurant import
 * Creates an Excel template for users to fill with restaurant data
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  /**
   * Generate an Excel template for restaurant import
   * @returns {Object} Template file info
   */
  async generateTemplate() {
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Create instruction sheet
      const instructionsSheet = createInstructionsSheet();
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
      
      // Create restaurant info sheet
      const restaurantSheet = createRestaurantSheet();
      XLSX.utils.book_append_sheet(workbook, restaurantSheet, 'Restaurant Info');
      
      // Create menus sheet
      const menusSheet = createMenusSheet();
      XLSX.utils.book_append_sheet(workbook, menusSheet, 'Menus');
      
      // Create menu items sheet
      const menuItemsSheet = createMenuItemsSheet();
      XLSX.utils.book_append_sheet(workbook, menuItemsSheet, 'Menu Items');
      
      // Create cuisines sheet
      const cuisinesSheet = createCuisinesSheet();
      XLSX.utils.book_append_sheet(workbook, cuisinesSheet, 'Cuisines');
      
      // Create sub-cuisines sheet
      const subCuisinesSheet = createSubCuisinesSheet();
      XLSX.utils.book_append_sheet(workbook, subCuisinesSheet, 'Sub-Cuisines');
      
      // Create sample data sheet
      const sampleDataSheet = createSampleDataSheet();
      XLSX.utils.book_append_sheet(workbook, sampleDataSheet, 'Sample Data');
      
      // Create temp file
      const tempFilePath = path.join(os.tmpdir(), 'restaurant-import-template.xlsx');
      XLSX.writeFile(workbook, tempFilePath);
      
      return {
        path: tempFilePath,
        filename: 'restaurant-import-template.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } catch (error) {
      strapi.log.error('Error generating Excel template:', error);
      throw new Error('Failed to generate Excel template');
    }
  }
};

/**
 * Create instructions sheet
 * @returns {Object} XLSX worksheet
 */
function createInstructionsSheet() {
  const instructions = [
    ['Restaurant Import Template Instructions'],
    [''],
    ['This Excel workbook contains sheets for importing restaurant data into AllerPal.'],
    ['Please follow these instructions to ensure successful data import:'],
    [''],
    ['1. Restaurant Info Sheet'],
    ['   - Fill in the basic information about your restaurant'],
    ['   - Required fields: Name, Email, Location'],
    ['   - For the Image field, you can use a URL or a base64-encoded image string'],
    [''],
    ['2. Menus Sheet'],
    ['   - List all menus for your restaurant'],
    ['   - ID is used to reference menus in the Menu Items sheet'],
    ['   - Type can be "normal" or "allergen"'],
    [''],
    ['3. Menu Items Sheet'],
    ['   - List all menu items with prices and details'],
    ['   - Each item must reference a Menu ID from the Menus sheet'],
    ['   - For allergens, provide a comma-separated list of allergen names'],
    ['   - For images, you can use a URL or a base64-encoded image string'],
    [''],
    ['4. Cuisines Sheet (Optional)'],
    ['   - List cuisines your restaurant offers'],
    ['   - Each cuisine needs a unique cuisine type'],
    [''],
    ['5. Sub-Cuisines Sheet (Optional)'],
    ['   - List sub-cuisines that belong to your main cuisines'],
    ['   - Each sub-cuisine must reference a parent cuisine from the Cuisines sheet'],
    [''],
    ['Tips:'],
    ['- Use the Sample Data sheet as a reference'],
    ['- Do not modify the column headers or sheet names'],
    ['- You can add as many rows as needed in each sheet'],
    ['- For boolean fields (is_available, is_vegetarian), use TRUE/FALSE or leave blank for FALSE'],
    [''],
    ['Questions? Contact support@allerpal.com']
  ];
  
  return XLSX.utils.aoa_to_sheet(instructions);
}

/**
 * Create restaurant sheet
 * @returns {Object} XLSX worksheet
 */
function createRestaurantSheet() {
  const headers = [
    'Name',
    'Email',
    'Location',
    'Description',
    'ContactNumber',
    'Rating',
    'Image'
  ];
  
  const data = [headers];
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 20 }, // Name
    { wch: 30 }, // Email
    { wch: 30 }, // Location
    { wch: 40 }, // Description
    { wch: 15 }, // ContactNumber
    { wch: 10 }, // Rating
    { wch: 50 }  // Image
  ];
  
  ws['!cols'] = colWidths;
  
  return ws;
}

/**
 * Create menus sheet
 * @returns {Object} XLSX worksheet
 */
function createMenusSheet() {
  const headers = [
    'ID',
    'name',
    'type'
  ];
  
  const data = [headers];
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 10 }, // ID
    { wch: 30 }, // name
    { wch: 15 }  // type
  ];
  
  ws['!cols'] = colWidths;
  
  return ws;
}

/**
 * Create menu items sheet
 * @returns {Object} XLSX worksheet
 */
function createMenuItemsSheet() {
  const headers = [
    'item_name',
    'description',
    'price',
    'is_available',
    'is_vegetarian',
    'menuId',
    'image',
    'allergens',
    'subCuisine'
  ];
  
  const data = [headers];
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 30 }, // item_name
    { wch: 40 }, // description
    { wch: 10 }, // price
    { wch: 12 }, // is_available
    { wch: 12 }, // is_vegetarian
    { wch: 10 }, // menuId
    { wch: 50 }, // image
    { wch: 30 }, // allergens
    { wch: 20 }  // subCuisine
  ];
  
  ws['!cols'] = colWidths;
  
  return ws;
}

/**
 * Create cuisines sheet
 * @returns {Object} XLSX worksheet
 */
function createCuisinesSheet() {
  const headers = [
    'cuisine_type',
    'cuisine_description',
    'cuisine_image'
  ];
  
  const data = [headers];
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 20 }, // cuisine_type
    { wch: 40 }, // cuisine_description
    { wch: 50 }  // cuisine_image
  ];
  
  ws['!cols'] = colWidths;
  
  return ws;
}

/**
 * Create sub-cuisines sheet
 * @returns {Object} XLSX worksheet
 */
function createSubCuisinesSheet() {
  const headers = [
    'sub_cuisine_name',
    'parentCuisine'
  ];
  
  const data = [headers];
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 25 }, // sub_cuisine_name
    { wch: 25 }  // parentCuisine
  ];
  
  ws['!cols'] = colWidths;
  
  return ws;
}

/**
 * Create sample data sheet
 * @returns {Object} XLSX worksheet
 */
function createSampleDataSheet() {
  const data = [
    ['Restaurant Info Example'],
    ['Name', 'Email', 'Location', 'Description', 'ContactNumber', 'Rating', 'Image'],
    ['Taste of India', 'contact@tasteofindia.com', '123 Main St, New York, NY', 'Authentic Indian restaurant with a modern twist', '+1 (212) 555-1234', '4.5', 'https://example.com/restaurant.jpg'],
    [''],
    ['Menus Example'],
    ['ID', 'name', 'type'],
    ['1', 'Main Menu', 'normal'],
    ['2', 'Allergen-Free Menu', 'allergen'],
    ['3', 'Desserts', 'normal'],
    [''],
    ['Menu Items Example'],
    ['item_name', 'description', 'price', 'is_available', 'is_vegetarian', 'menuId', 'image', 'allergens', 'subCuisine'],
    ['Butter Chicken', 'Tender chicken in a creamy tomato sauce', '14.99', 'TRUE', 'FALSE', '1', 'https://example.com/butter-chicken.jpg', 'dairy, nuts', 'North Indian'],
    ['Vegetable Biryani', 'Mixed vegetables with basmati rice', '12.99', 'TRUE', 'TRUE', '1', 'https://example.com/biryani.jpg', 'gluten', 'South Indian'],
    ['Gulab Jamun', 'Sweet milk solids in sugar syrup', '5.99', 'TRUE', 'TRUE', '3', 'https://example.com/gulab-jamun.jpg', 'dairy, gluten', 'Desserts'],
    [''],
    ['Cuisines Example'],
    ['cuisine_type', 'cuisine_description', 'cuisine_image'],
    ['Indian', 'Traditional Indian cuisine with regional specialties', 'https://example.com/indian-cuisine.jpg'],
    ['Indo-Chinese', 'Fusion cuisine combining Indian and Chinese flavors', 'https://example.com/indo-chinese.jpg'],
    [''],
    ['Sub-Cuisines Example'],
    ['sub_cuisine_name', 'parentCuisine'],
    ['North Indian', 'Indian'],
    ['South Indian', 'Indian'],
    ['Desserts', 'Indian']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 25 },
    { wch: 30 },
    { wch: 30 },
    { wch: 40 },
    { wch: 15 },
    { wch: 10 },
    { wch: 50 }
  ];
  
  ws['!cols'] = colWidths;
  
  return ws;
} 