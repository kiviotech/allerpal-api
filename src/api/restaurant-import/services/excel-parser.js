'use strict';

/**
 * Enhanced Excel parser for restaurant import
 * Handles parsing of Excel files with support for allergens
 */

const xlsx = require('xlsx');
const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::restaurant-import.restaurant-import', ({ strapi }) => ({
  /**
   * Parse an Excel file into a structured data object
   * @param {Buffer} buffer - Excel file buffer
   * @returns {Object} Parsed data
   */
  async parseExcel(buffer) {
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      
      // Initialize results object
      const parsedData = {
        restaurant: {},
        menus: [],
        menuItems: [],
        allergens: [],
        warnings: [],
        errors: []
      };
      
      // Parse restaurant data (first sheet)
      if (workbook.SheetNames.includes('Restaurants')) {
        const restaurantSheet = workbook.Sheets['Restaurants'];
        const restaurants = xlsx.utils.sheet_to_json(restaurantSheet);
        
        if (restaurants.length > 0) {
          parsedData.restaurant = restaurants[0];
        } else {
          throw new Error('No restaurant data found in the Excel file');
        }
      } else {
        throw new Error('Required sheet "Restaurants" not found in the Excel file');
      }
      
      // Parse menus data
      if (workbook.SheetNames.includes('Menus')) {
        const menuSheet = workbook.Sheets['Menus'];
        const menus = xlsx.utils.sheet_to_json(menuSheet);
        
        // Validate menus
        for (const menu of menus) {
          if (!menu.Type) {
            parsedData.warnings.push('Menu type not specified, using "normal" as default');
            menu.type = 'normal';
          } else {
            menu.type = menu.Type.toLowerCase();
          }
          
          // Convert to our schema format
          parsedData.menus.push({
            type: menu.type,
            restaurant_email: menu.RestaurantEmail
          });
        }
      } else {
        // If no Menus sheet, create default menus
        parsedData.menus = [
          { type: 'normal' },
          { type: 'allergen' }
        ];
        parsedData.warnings.push('No "Menus" sheet found, using default menu types (normal, allergen)');
      }
      
      // Parse allergens data (optional sheet)
      if (workbook.SheetNames.includes('Allergens')) {
        const allergenSheet = workbook.Sheets['Allergens'];
        const allergens = xlsx.utils.sheet_to_json(allergenSheet);
        
        // Validate and normalize allergens
        for (const allergen of allergens) {
          if (!allergen.Name) {
            parsedData.warnings.push('Allergen without name found, skipping');
            continue;
          }
          
          parsedData.allergens.push({
            name: allergen.Name,
            description: allergen.Description || '',
            is_custom: allergen.IsCustom === 'true' || allergen.IsCustom === true
          });
        }
      }
      
      // Parse menu items
      if (workbook.SheetNames.includes('MenuItems')) {
        const menuItemSheet = workbook.Sheets['MenuItems'];
        const menuItems = xlsx.utils.sheet_to_json(menuItemSheet);
        
        // Validate and process menu items
        for (const item of menuItems) {
          // Check for required fields
          if (!item.Name) {
            parsedData.warnings.push('Menu item without name found, skipping');
            continue;
          }
          
          const menuItem = {
            item_name: item.Name,
            description: item.Description || '',
            price: item.Price,
            is_available: item.Available === 'true' || item.Available === true,
            is_vegetarian: item.Vegetarian === 'true' || item.Vegetarian === true,
            menu_type: item.MenuType?.toLowerCase() || 'normal',
            restaurant_email: item.RestaurantEmail,
            allergens: item.Allergens || '',
            image: item.ImageData || null
          };
          
          parsedData.menuItems.push(menuItem);
        }
      } else {
        throw new Error('Required sheet "MenuItems" not found in the Excel file');
      }
      
      // Validate relationships
      this.validateRelationships(parsedData);
      
      return parsedData;
    } catch (error) {
      strapi.log.error('Error parsing Excel file:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  },

  /**
   * Validate relationships between entities
   * @param {Object} parsedData - The data to validate
   */
  validateRelationships(parsedData) {
    const restaurantEmail = parsedData.restaurant.Email;
    
    if (!restaurantEmail) {
      throw new Error('Restaurant email is required for relationship mapping');
    }
    
    // Check menu item relationships
    for (const item of parsedData.menuItems) {
      // Check if the menu item is associated with the correct restaurant
      if (item.restaurant_email && item.restaurant_email !== restaurantEmail) {
        parsedData.warnings.push(
          `Menu item "${item.item_name}" has a different restaurant email (${item.restaurant_email}) than the main restaurant (${restaurantEmail})`
        );
        // Correct the restaurant email
        item.restaurant_email = restaurantEmail;
      }
      
      // Check if the specified menu type exists in the parsed menus
      const menuTypeExists = parsedData.menus.some(menu => menu.type === item.menu_type);
      if (!menuTypeExists) {
        parsedData.warnings.push(
          `Menu item "${item.item_name}" has menu type "${item.menu_type}" which is not defined in the Menus sheet`
        );
        // Will be handled by creating default menus during processing
      }
    }
    
    return true;
  },

  /**
   * Generate an Excel template for import
   * @returns {Buffer} Excel template buffer
   */
  generateTemplate() {
    const workbook = xlsx.utils.book_new();
    
    // Restaurants sheet
    const restaurantSampleData = [
      {
        Name: "Sample Restaurant",
        Email: "restaurant@example.com",
        Location: "123 Main St, City",
        Description: "A sample restaurant description",
        ContactNumber: "+1234567890",
        Rating: 4.5,
        ImageData: "" // Base64 data for image (optional)
      }
    ];
    
    const restaurantSheet = xlsx.utils.json_to_sheet(restaurantSampleData);
    xlsx.utils.book_append_sheet(workbook, restaurantSheet, 'Restaurants');
    
    // Menus sheet
    const menuSampleData = [
      { Type: "normal", RestaurantEmail: "restaurant@example.com" },
      { Type: "allergen", RestaurantEmail: "restaurant@example.com" }
    ];
    
    const menuSheet = xlsx.utils.json_to_sheet(menuSampleData);
    xlsx.utils.book_append_sheet(workbook, menuSheet, 'Menus');
    
    // Allergens sheet
    const allergenSampleData = [
      { Name: "Peanuts", Description: "Peanut allergen", IsCustom: false },
      { Name: "Gluten", Description: "Wheat and gluten allergen", IsCustom: false },
      { Name: "Shellfish", Description: "Shellfish allergen", IsCustom: false }
    ];
    
    const allergenSheet = xlsx.utils.json_to_sheet(allergenSampleData);
    xlsx.utils.book_append_sheet(workbook, allergenSheet, 'Allergens');
    
    // Menu items sheet
    const menuItemSampleData = [
      {
        Name: "Burger",
        Description: "Delicious burger with cheese",
        Price: 12.99,
        Available: true,
        Vegetarian: false,
        MenuType: "normal",
        RestaurantEmail: "restaurant@example.com",
        Allergens: "Gluten,Dairy",
        ImageData: "" // Base64 data for image (optional)
      },
      {
        Name: "Salad",
        Description: "Fresh garden salad",
        Price: 8.99,
        Available: true,
        Vegetarian: true,
        MenuType: "allergen",
        RestaurantEmail: "restaurant@example.com",
        Allergens: "Nuts",
        ImageData: "" // Base64 data for image (optional)
      }
    ];
    
    const menuItemSheet = xlsx.utils.json_to_sheet(menuItemSampleData);
    xlsx.utils.book_append_sheet(workbook, menuItemSheet, 'MenuItems');
    
    // Instructions sheet
    const instructionsData = [
      { 
        Section: "General",
        Instructions: "This template is for importing restaurants, menus, menu items, and allergens."
      },
      {
        Section: "Restaurants",
        Instructions: "Required fields: Name, Email. The Email is used as a unique identifier."
      },
      {
        Section: "Menus",
        Instructions: "Required fields: Type. Valid types are 'normal' and 'allergen'."
      },
      {
        Section: "Allergens",
        Instructions: "List all allergens that will be referenced by menu items."
      },
      {
        Section: "Menu Items",
        Instructions: "Required fields: Name, MenuType. For Allergens, provide a comma-separated list of allergen names."
      }
    ];
    
    const instructionsSheet = xlsx.utils.json_to_sheet(instructionsData);
    xlsx.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
    
    // Convert to buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
})); 