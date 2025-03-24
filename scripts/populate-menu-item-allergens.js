/**
 * Script to populate menu item allergens based on their descriptions
 * 
 * This script:
 * 1. Fetches all menu items
 * 2. Fetches all allergies
 * 3. For each menu item, checks if its description contains any allergy names
 * 4. If it does, adds the allergy to the menu item's allergens
 * 
 * Run with: node scripts/populate-menu-item-allergens.js
 */

const Strapi = require('@strapi/strapi');

async function populateMenuItemAllergens() {
  try {
    // Start Strapi in silent mode
    console.log('Starting Strapi...');
    const strapi = await Strapi().load();
    console.log('Strapi started successfully');

    // Get all menu items
    console.log('Fetching menu items...');
    const menuItems = await strapi.entityService.findMany('api::menu-item.menu-item', {
      populate: ['allergens'],
    });
    console.log(`Found ${menuItems.length} menu items`);

    // Get all allergies
    console.log('Fetching allergies...');
    const allergies = await strapi.entityService.findMany('api::allergy.allergy', {
      fields: ['id', 'name'],
    });
    console.log(`Found ${allergies.length} allergies`);

    // Process each menu item
    let updatedCount = 0;
    for (const menuItem of menuItems) {
      const description = (menuItem.description || '').toLowerCase();
      const existingAllergenIds = (menuItem.allergens || []).map(a => a.id);
      const newAllergenIds = [];

      // Check if description contains any allergy names
      for (const allergy of allergies) {
        const allergyName = allergy.name.toLowerCase();
        if (description.includes(allergyName) && !existingAllergenIds.includes(allergy.id)) {
          newAllergenIds.push(allergy.id);
        }
      }

      // If new allergens found, update the menu item
      if (newAllergenIds.length > 0) {
        console.log(`Updating menu item ${menuItem.id} (${menuItem.item_name}) with ${newAllergenIds.length} new allergens`);
        
        await strapi.entityService.update('api::menu-item.menu-item', menuItem.id, {
          data: {
            allergens: [...existingAllergenIds, ...newAllergenIds],
          },
        });
        
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} menu items with allergens`);
    
    // Stop Strapi
    console.log('Stopping Strapi...');
    await strapi.destroy();
    console.log('Strapi stopped successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

populateMenuItemAllergens(); 