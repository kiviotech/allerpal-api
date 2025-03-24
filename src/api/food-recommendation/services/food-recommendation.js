'use strict';

/**
 * food-recommendation service
 */

module.exports = () => ({
  // Helper function to get a user's allergies by profile ID
  async getAllergensByProfileId(profileId) {
    console.log(`[food-recommendation-service] Getting allergens for profileId: ${profileId}`);
    
    try {
      // First, check if the profile exists
      const profile = await strapi.entityService.findOne('api::profile.profile', profileId, {
        populate: ['profile_allergies'],
      });
      
      if (!profile) {
        console.log(`[food-recommendation-service] Profile with ID ${profileId} not found`);
        return [];
      }
      
      console.log(`[food-recommendation-service] Found profile: ${profile.id}, name: ${profile.name}`);
      console.log(`[food-recommendation-service] Profile has ${profile.profile_allergies?.length || 0} profile_allergies entries`);
      
      // Get profile allergies
      const profileAllergies = await strapi.entityService.findMany('api::profile-allergy.profile-allergy', {
        filters: { profile: profileId },
        populate: { allergies: true },
      });
      
      console.log(`[food-recommendation-service] Found ${profileAllergies.length} profile_allergy records for profile ${profileId}`);
      
      const allergenIds = [];
      profileAllergies.forEach(profileAllergy => {
        console.log(`[food-recommendation-service] Profile allergy ${profileAllergy.id} has ${profileAllergy.allergies?.length || 0} allergies`);
        
        if (profileAllergy.allergies && profileAllergy.allergies.length > 0) {
          profileAllergy.allergies.forEach(allergy => {
            console.log(`[food-recommendation-service] Adding allergen: ${allergy.id} (${allergy.name})`);
            allergenIds.push(allergy.id);
          });
        }
      });
      
      console.log(`[food-recommendation-service] Returning ${allergenIds.length} allergen IDs:`, allergenIds);
      return allergenIds;
    } catch (error) {
      console.error(`[food-recommendation-service] Error getting allergens for profile ${profileId}:`, error);
      return [];
    }
  },

  // Helper function to filter out refreshments and juices
  filterNonFoodItems(menuItems) {
    console.log(`[food-recommendation-service] Filtering ${menuItems.length} menu items to exclude refreshments and juices`);
    
    const filteredItems = menuItems.filter(item => {
      if (!item.sub_cuisine) {
        console.log(`[food-recommendation-service] Item ${item.id} (${item.item_name}) has no sub_cuisine, including by default`);
        return true;
      }
      
      if (!item.sub_cuisine.sub_cuisine_name) {
        console.log(`[food-recommendation-service] Item ${item.id} (${item.item_name}) has sub_cuisine but no name, including by default`);
        return true;
      }
      
      const subCuisineName = item.sub_cuisine.sub_cuisine_name.toLowerCase();
      const isRefreshment = subCuisineName.includes('juice') || 
                           subCuisineName.includes('beverage') || 
                           subCuisineName.includes('drink') ||
                           subCuisineName.includes('refreshment');
      
      if (isRefreshment) {
        console.log(`[food-recommendation-service] Excluding item ${item.id} (${item.item_name}) with sub_cuisine: ${subCuisineName}`);
      } else {
        console.log(`[food-recommendation-service] Including item ${item.id} (${item.item_name}) with sub_cuisine: ${subCuisineName}`);
      }
      
      return !isRefreshment;
    });
    
    console.log(`[food-recommendation-service] Filtered from ${menuItems.length} to ${filteredItems.length} items`);
    return filteredItems;
  },
}); 