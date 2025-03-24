'use strict';

/**
 * food-recommendation router
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/food-recommendations',
      handler: 'food-recommendation.getRecommendations',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get food recommendations for a profile',
        params: {
          profileId: {
            type: 'string',
            required: true,
            description: 'ID of the profile to get recommendations for',
          },
          restaurantId: {
            type: 'string',
            required: false,
            description: 'Optional: ID of the restaurant to filter menu items',
          },
        },
      },
    },
    {
      method: 'GET',
      path: '/food-recommendations/test',
      handler: 'food-recommendation.testEndpoint',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/food-recommendations/debug-profile',
      handler: 'food-recommendation.debugProfileData',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/food-recommendations/debug-menu-items',
      handler: 'food-recommendation.debugMenuItems',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/food-recommendations/by-cuisine',
      handler: 'food-recommendation.getRecommendationsByCuisine',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/food-recommendations/popular',
      handler: 'food-recommendation.getPopularRecommendations',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 