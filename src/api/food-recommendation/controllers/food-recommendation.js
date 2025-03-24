'use strict';

/**
 * A set of functions called "actions" for `food-recommendation`
 */

module.exports = {
  async testEndpoint(ctx) {
    try {
      console.log('[food-recommendation] Test endpoint called');
      
      // Return a simple response to confirm the API is working
      return {
        status: 'success',
        message: 'Food recommendation API is working correctly',
        timestamp: new Date().toISOString(),
        query: ctx.query
      };
    } catch (error) {
      console.error('[food-recommendation] Error in test endpoint:', error);
      return ctx.badRequest(`Error in test endpoint: ${error.message}`);
    }
  },

  async debugProfileData(ctx) {
    try {
      console.log('[food-recommendation] Debug profile data endpoint called with query:', ctx.query);
      const { profileId } = ctx.query;
      
      if (!profileId) {
        return ctx.badRequest('Profile ID is required');
      }
      
      // Get profile data
      const profile = await strapi.entityService.findOne('api::profile.profile', profileId, {
        populate: ['user', 'profile_allergies'],
      });
      
      if (!profile) {
        return {
          status: 'error',
          message: `Profile with ID ${profileId} not found`,
        };
      }
      
      // Get profile allergies
      const profileAllergies = await strapi.entityService.findMany('api::profile-allergy.profile-allergy', {
        filters: { profile: profileId },
        populate: { allergies: true },
      });
      
      // Get menu items count
      const menuItemsCount = await strapi.db.query('api::menu-item.menu-item').count();
      
      // Get menu items with allergens
      const menuItemsWithAllergens = await strapi.db.query('api::menu-item.menu-item').count({
        where: {
          allergens: {
            id: {
              $notNull: true,
            },
          },
        },
      });
      
      return {
        status: 'success',
        profile: {
          id: profile.id,
          name: profile.name,
          relation: profile.relation,
          userId: profile.user?.id,
        },
        profileAllergies: profileAllergies.map(pa => ({
          id: pa.id,
          severity: pa.severity,
          excludeMayContain: pa.excludeMayContain,
          allergiesCount: pa.allergies?.length || 0,
          allergies: pa.allergies?.map(a => ({
            id: a.id,
            name: a.name,
            is_custom: a.is_custom,
          })),
        })),
        menuItemsStats: {
          totalCount: menuItemsCount,
          withAllergensCount: menuItemsWithAllergens,
        },
      };
    } catch (error) {
      console.error('[food-recommendation] Error in debug profile data endpoint:', error);
      return ctx.badRequest(`Error in debug profile data endpoint: ${error.message}`);
    }
  },

  async debugMenuItems(ctx) {
    try {
      console.log('[food-recommendation] Debug menu items endpoint called with query:', ctx.query);
      const { limit = 10 } = ctx.query;
      
      // Get menu items with allergens
      const menuItems = await strapi.entityService.findMany('api::menu-item.menu-item', {
        populate: ['allergens', 'sub_cuisine', 'restaurant'],
        limit: parseInt(limit),
      });
      
      // Get all allergens
      const allergens = await strapi.entityService.findMany('api::allergy.allergy', {
        fields: ['id', 'name'],
      });
      
      // Get all sub-cuisines
      const subCuisines = await strapi.entityService.findMany('api::sub-cuisine.sub-cuisine', {
        fields: ['id', 'sub_cuisine_name'],
        populate: ['cuisine'],
      });
      
      return {
        status: 'success',
        menuItemsCount: menuItems.length,
        menuItems: menuItems.map(item => ({
          id: item.id,
          item_name: item.item_name,
          is_vegetarian: item.is_vegetarian,
          is_available: item.is_available,
          sub_cuisine: item.sub_cuisine ? {
            id: item.sub_cuisine.id,
            name: item.sub_cuisine.sub_cuisine_name,
            cuisine: item.sub_cuisine.cuisine ? {
              id: item.sub_cuisine.cuisine.id,
              name: item.sub_cuisine.cuisine.cuisine_name,
            } : null,
          } : null,
          restaurant: item.restaurant ? {
            id: item.restaurant.id,
            name: item.restaurant.name,
          } : null,
          allergensCount: item.allergens?.length || 0,
          allergens: item.allergens?.map(a => ({
            id: a.id,
            name: a.name,
          })),
        })),
        allergensCount: allergens.length,
        allergens: allergens.map(a => ({
          id: a.id,
          name: a.name,
        })),
        subCuisinesCount: subCuisines.length,
        subCuisines: subCuisines.map(sc => ({
          id: sc.id,
          name: sc.sub_cuisine_name,
          cuisine: sc.cuisine ? {
            id: sc.cuisine.id,
            name: sc.cuisine.cuisine_name,
          } : null,
        })),
      };
    } catch (error) {
      console.error('[food-recommendation] Error in debug menu items endpoint:', error);
      return ctx.badRequest(`Error in debug menu items endpoint: ${error.message}`);
    }
  },

  async getRecommendations(ctx) {
    const { profileId, restaurantId, page = 1, pageSize = 20 } = ctx.request.query;
    
    if (!profileId) {
      return ctx.badRequest('Profile ID is required');
    }
    
    try {
      console.log(`[food-recommendation] Getting recommendations for profile ${profileId}${restaurantId ? ` at restaurant ${restaurantId}` : ''}`);
      console.log(`[food-recommendation] Pagination: page ${page}, pageSize ${pageSize}`);
      
      // Get allergens for the profile
      const allergenIds = await strapi.service('api::food-recommendation.food-recommendation')
        .getAllergensByProfileId(profileId);
      
      console.log(`[food-recommendation] Found ${allergenIds.length} allergens for profile ${profileId}`);
      
      let menuItems = [];
      
      // If restaurantId is provided, get menu items from that restaurant
      if (restaurantId) {
        console.log(`[food-recommendation] Fetching menu items for restaurant ${restaurantId}`);
        const restaurant = await strapi.entityService.findOne('api::restaurant.restaurant', restaurantId, {
          populate: {
            menu_items: {
              populate: {
                allergens: true,
                sub_cuisine: true,
                image: true,
              },
            },
            image: true,
          },
        });
        
        if (!restaurant) {
          return ctx.notFound('Restaurant not found');
        }
        
        console.log(`[food-recommendation] Found restaurant: ${restaurant.name}`);
        console.log(`[food-recommendation] Restaurant has ${restaurant.menu_items?.length || 0} menu items`);
        
        // Add restaurant details to each menu item
        menuItems = (restaurant.menu_items || []).map(item => ({
          ...item,
          restaurant: {
            id: restaurant.id,
            documentId: restaurant.id, // Add documentId for the frontend
            name: restaurant.name,
            location: restaurant.location,
            rating: restaurant.rating,
            image: restaurant.image
          }
        }));
      } 
      // If no restaurantId, get all menu items
      else {
        console.log(`[food-recommendation] No restaurant ID provided, fetching all menu items`);
        menuItems = await strapi.entityService.findMany('api::menu-item.menu-item', {
          populate: {
            allergens: true,
            sub_cuisine: true,
            restaurant: {
              populate: ['image']
            },
            image: true
          },
          limit: 500, // Set a reasonable limit
        });
        
        console.log(`[food-recommendation] Found ${menuItems.length} menu items across all restaurants`);
        
        // Add documentId to restaurant data for each menu item
        menuItems = menuItems.map(item => {
          if (item.restaurant) {
            return {
              ...item,
              restaurant: {
                ...item.restaurant,
                documentId: item.restaurant.id // Add documentId for the frontend
              }
            };
          }
          return item;
        });
      }
      
      // Filter out refreshments and juices
      const foodItems = strapi.service('api::food-recommendation.food-recommendation')
        .filterNonFoodItems(menuItems);
      
      // Filter for safe items only
      const safeItems = foodItems.filter(item => {
        const itemAllergens = item.allergens?.map(a => a.id) || [];
        const commonAllergens = itemAllergens.filter(id => allergenIds.includes(id));
        return commonAllergens.length === 0;
      });
      
      console.log(`[food-recommendation] Found ${safeItems.length} safe items`);
      
      // Apply pagination
      const pageInt = parseInt(page, 10);
      const pageSizeInt = parseInt(pageSize, 10);
      const startIndex = (pageInt - 1) * pageSizeInt;
      const endIndex = startIndex + pageSizeInt;
      
      const paginatedItems = safeItems.slice(startIndex, endIndex);
      
      // Calculate pagination metadata
      const totalItems = safeItems.length;
      const totalPages = Math.ceil(totalItems / pageSizeInt);
      
      console.log(`[food-recommendation] Returning ${paginatedItems.length} items for page ${pageInt}`);
      
      return {
        data: paginatedItems,
        meta: {
          pagination: {
            page: pageInt,
            pageSize: pageSizeInt,
            pageCount: totalPages,
            total: totalItems
          }
        }
      };
      
    } catch (error) {
      console.error('[food-recommendation] Error getting recommendations:', error);
      return ctx.internalServerError('Error getting food recommendations');
    }
  },

  async getRecommendationsByCuisine(ctx) {
    try {
      console.log('[food-recommendation] getRecommendationsByCuisine called with query:', ctx.query);
      const { profileId, cuisineId, page = 1, pageSize = 10, sort = 'item_name:asc' } = ctx.query;
      
      if (!profileId || !cuisineId) {
        console.log('[food-recommendation] Missing profileId or cuisineId in request');
        return ctx.badRequest('Profile ID and Cuisine ID are required');
      }

      console.log(`[food-recommendation] Processing request for profileId: ${profileId}, cuisineId: ${cuisineId}`);
      
      // Get the service
      const foodRecommendationService = strapi.service('api::food-recommendation.food-recommendation');
      
      // Get the profile's allergies
      console.log(`[food-recommendation] Fetching allergens for profileId: ${profileId}`);
      const allergenIds = await foodRecommendationService.getAllergensByProfileId(profileId);
      console.log(`[food-recommendation] Found ${allergenIds.length} allergens for profile:`, allergenIds);

      // Build the query
      const query = {
        filters: {
          sub_cuisine: {
            cuisine: {
              id: cuisineId,
            },
          },
        },
        populate: {
          image: true,
          restaurant: {
            populate: ['image']
          },
          sub_cuisine: {
            populate: {
              cuisine: true,
            },
          },
          allergens: true,
        },
        sort: sort.split(','),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
        },
      };

      // Add allergen filtering if user has allergies
      if (allergenIds.length > 0) {
        console.log(`[food-recommendation] Adding allergen filters to exclude ${allergenIds.length} allergens`);
        query.filters.allergens = {
          id: {
            $notIn: allergenIds,
          },
        };
      } else {
        console.log('[food-recommendation] No allergens to filter, returning all menu items for cuisine');
      }

      console.log('[food-recommendation] Final query:', JSON.stringify(query, null, 2));

      // Query for menu items
      console.log('[food-recommendation] Executing query to find menu items by cuisine');
      const { results: menuItems, pagination } = await strapi.entityService.findPage('api::menu-item.menu-item', query);
      console.log(`[food-recommendation] Found ${menuItems.length} menu items before filtering`);

      // Filter out refreshments and juices
      console.log('[food-recommendation] Filtering out refreshments and juices');
      const filteredMenuItems = foodRecommendationService.filterNonFoodItems(menuItems);
      console.log(`[food-recommendation] ${filteredMenuItems.length} menu items remain after filtering`);

      // Add documentId to restaurant objects for the frontend
      const enhancedMenuItems = filteredMenuItems.map(item => {
        if (item.restaurant) {
          return {
            ...item,
            restaurant: {
              ...item.restaurant,
              documentId: item.restaurant.id
            }
          };
        }
        return item;
      });

      // Return the filtered items with pagination info
      const response = {
        data: enhancedMenuItems,
        meta: {
          pagination: {
            ...pagination,
            // Adjust the total count based on our filtering
            total: enhancedMenuItems.length,
          },
        },
      };
      
      console.log(`[food-recommendation] Returning response with ${enhancedMenuItems.length} items`);
      return response;
    } catch (error) {
      console.error('[food-recommendation] Error in getRecommendationsByCuisine:', error);
      return ctx.badRequest(`Error getting food recommendations by cuisine: ${error.message}`);
    }
  },

  async getPopularRecommendations(ctx) {
    try {
      console.log('[food-recommendation] getPopularRecommendations called with query:', ctx.query);
      const { profileId, page = 1, pageSize = 10 } = ctx.query;
      
      if (!profileId) {
        console.log('[food-recommendation] Missing profileId in request');
        return ctx.badRequest('Profile ID is required');
      }

      console.log(`[food-recommendation] Processing request for profileId: ${profileId}`);
      
      // Get the service
      const foodRecommendationService = strapi.service('api::food-recommendation.food-recommendation');
      
      // Get the profile's allergies
      console.log(`[food-recommendation] Fetching allergens for profileId: ${profileId}`);
      const allergenIds = await foodRecommendationService.getAllergensByProfileId(profileId);
      console.log(`[food-recommendation] Found ${allergenIds.length} allergens for profile:`, allergenIds);

      // Build the query to get menu items from restaurants with high ratings
      const query = {
        filters: {
          // Ensure restaurant exists
          restaurant: {
            id: {
              $notNull: true
            }
          }
        },
        populate: {
          image: true,
          restaurant: {
            populate: ['image', 'reviews'],
          },
          sub_cuisine: {
            populate: {
              cuisine: true,
            },
          },
          allergens: true,
        },
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
        },
      };

      // Add allergen filtering if user has allergies
      if (allergenIds.length > 0) {
        console.log(`[food-recommendation] Adding allergen filters to exclude ${allergenIds.length} allergens`);
        query.filters.allergens = {
          id: {
            $notIn: allergenIds,
          },
        };
      } else {
        console.log('[food-recommendation] No allergens to filter, returning all menu items');
      }

      console.log('[food-recommendation] Final query:', JSON.stringify(query, null, 2));

      // Query for menu items
      console.log('[food-recommendation] Executing query to find popular menu items');
      const { results: menuItems, pagination } = await strapi.entityService.findPage('api::menu-item.menu-item', query);
      console.log(`[food-recommendation] Found ${menuItems.length} menu items before filtering`);

      // Filter out refreshments and juices
      console.log('[food-recommendation] Filtering out refreshments and juices');
      let filteredMenuItems = foodRecommendationService.filterNonFoodItems(menuItems);
      console.log(`[food-recommendation] ${filteredMenuItems.length} menu items remain after filtering`);

      // Make sure all items have restaurant information
      filteredMenuItems = filteredMenuItems.filter(item => item.restaurant && item.restaurant.id);
      console.log(`[food-recommendation] ${filteredMenuItems.length} menu items have restaurant information`);

      // Sort by restaurant rating (if available)
      console.log('[food-recommendation] Sorting menu items by restaurant rating');
      filteredMenuItems = filteredMenuItems.sort((a, b) => {
        const aRating = a.restaurant?.rating || 0;
        const bRating = b.restaurant?.rating || 0;
        return bRating - aRating; // Sort by descending rating
      });

      // Add documentId to restaurant objects for the frontend
      const enhancedMenuItems = filteredMenuItems.map(item => {
        if (item.restaurant) {
          return {
            ...item,
            restaurant: {
              ...item.restaurant,
              documentId: item.restaurant.id
            }
          };
        }
        return item;
      });

      // Return the filtered and sorted items with pagination info
      const response = {
        data: enhancedMenuItems,
        meta: {
          pagination: {
            ...pagination,
            // Adjust the total count based on our filtering
            total: enhancedMenuItems.length,
          },
        },
      };
      
      console.log(`[food-recommendation] Returning response with ${enhancedMenuItems.length} items`);
      return response;
    } catch (error) {
      console.error('[food-recommendation] Error in getPopularRecommendations:', error);
      return ctx.badRequest(`Error getting popular food recommendations: ${error.message}`);
    }
  },
}; 