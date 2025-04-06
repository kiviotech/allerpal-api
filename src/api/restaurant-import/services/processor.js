'use strict';

/**
 * Processor service for restaurant import
 * Handles the creation of restaurants, menus, menu items, etc. from validated Excel data
 */
module.exports = {
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
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format.');
      }

      // Create or update the restaurant
      results.restaurant = await createRestaurant(data.restaurant);
      if (!results.restaurant) throw new Error('Failed to create restaurant.');

      // Process menus
      if (Array.isArray(data.menus) && data.menus.length > 0) {
        results.menus = await createMenus(data.menus, results.restaurant.id);
      }

      // Process cuisines
      if (Array.isArray(data.cuisines) && data.cuisines.length > 0) {
        results.cuisines = await createCuisines(data.cuisines, results.restaurant.id);
      }

      // Process sub-cuisines
      if (Array.isArray(data.subCuisines) && data.subCuisines.length > 0) {
        results.subCuisines = await createSubCuisines(data.subCuisines, results.cuisines);
      }

      // Process menu items
      if (Array.isArray(data.menuItems) && data.menuItems.length > 0) {
        results.menuItems = await createMenuItems(
          data.menuItems,
          results.restaurant.id,
          results.menus,
          results.subCuisines
        );
      }

      return { success: true, results };
    } catch (error) {
      strapi.log.error('Error processing restaurant import data:', error);
      return { success: false, error: error.message, results };
    }
  },


  async processJsonData(data, options = {}) {
    const results = {
      restaurants: [],
      menuItems: [],
      allergens: [],
      errors: []
    };

    try {
      if (!data || !Array.isArray(data.restaurants)) {
        throw new Error('Invalid JSON data format.');
      }

      for (const restaurantData of data.restaurants) {
        try {
          const restaurant = await createRestaurant({
            Name: restaurantData.name,
            Email: restaurantData.email,
            Location: restaurantData.location,
            Description: restaurantData.description,
            ContactNumber: restaurantData.contact_number,
            Rating: restaurantData.rating,
            Image: restaurantData.images?.[0]?.data
          });

          if (!restaurant) throw new Error(`Failed to process restaurant: ${restaurantData.name}`);

          if (Array.isArray(restaurantData.menuItems)) {
            for (const menuItemData of restaurantData.menuItems) {
              try {
                const menuItem = await createMenuItems(
                  [{ 
                    item_name: menuItemData.item_name,
                    description: menuItemData.description,
                    price: menuItemData.price,
                    is_available: menuItemData.is_available,
                    is_vegetarian: menuItemData.is_vegetarian,
                    allergens: menuItemData.allergens?.map(a => a.name),
                    image: menuItemData.images?.[0]?.data
                  }],
                  restaurant.id,
                  [],
                  []
                );

                if (menuItem && menuItem.length) {
                  results.menuItems.push(menuItem[0]);
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

          results.restaurants.push(restaurant);
        } catch (error) {
          strapi.log.error(`Error processing restaurant ${restaurantData.name}:`, error);
          results.errors.push({
            type: 'restaurant',
            name: restaurantData.name,
            error: error.message
          });
        }
      }

      return {
        success: results.errors.length === 0,
        results,
        error: results.errors.length > 0 ? `${results.errors.length} errors occurred.` : null
      };
    } catch (error) {
      strapi.log.error('Error processing JSON restaurant import:', error);
      return { success: false, error: error.message, results };
    }
  }
};


async function createRestaurant(restaurantData) {
  try {
    const existingRestaurant = await strapi.entityService.findMany('api::restaurant.restaurant', {
      filters: { email: restaurantData.Email }
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
      const file = await uploadImage(restaurantData.Image, `restaurant-${restaurantData.Name}`);
      if (file) {
        restaurantEntry.image = file.id;
      }
    }

    if (existingRestaurant.length > 0) {
      return await strapi.entityService.update(
        'api::restaurant.restaurant',
        existingRestaurant[0].id,
        { data: restaurantEntry }
      );
    } else {
      return await strapi.entityService.create(
        'api::restaurant.restaurant',
        { data: restaurantEntry }
      );
    }
  } catch (error) {
    strapi.log.error('Error creating restaurant:', error);
    throw new Error(`Failed to create restaurant: ${error.message}`);
  }
}


async function createMenus(menusData, restaurantId) {
  const createdMenus = [];

  for (const menuData of menusData) {
    try {
      const existingMenus = await strapi.entityService.findMany('api::menu.menu', {
        filters: { restaurant: { id: restaurantId }, type: menuData.name }
      });

      const menuEntry = {
        type: menuData.type || 'normal',
        restaurant: restaurantId
      };

      let menu;
      if (existingMenus.length > 0) {
        menu = await strapi.entityService.update(
          'api::menu.menu',
          existingMenus[0].id,
          { data: menuEntry }
        );
      } else {
        menu = await strapi.entityService.create('api::menu.menu', { data: menuEntry });
      }

      createdMenus.push(menu);
    } catch (error) {
      strapi.log.error(`Error processing menu ${menuData.name}:`, error);
    }
  }

  return createdMenus;
}