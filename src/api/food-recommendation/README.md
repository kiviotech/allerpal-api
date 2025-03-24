# Food Recommendation API

This API provides food recommendations based on user allergies, filtering out menu items that contain allergens the user is allergic to.

## Endpoints

### Test Endpoint
- **URL**: `/api/food-recommendations/test`
- **Method**: GET
- **Description**: Simple test endpoint to check if the API is working correctly.
- **Response**: 
  ```json
  {
    "status": "success",
    "message": "Food recommendation API is working correctly",
    "timestamp": "2023-05-01T12:00:00.000Z",
    "query": {}
  }
  ```

### Debug Profile Data
- **URL**: `/api/food-recommendations/debug-profile`
- **Method**: GET
- **Parameters**: 
  - `profileId` (required): The ID of the profile to debug
- **Description**: Returns detailed information about a profile and its allergies.
- **Response**: Profile data, allergies, and menu item statistics.

### Debug Menu Items
- **URL**: `/api/food-recommendations/debug-menu-items`
- **Method**: GET
- **Parameters**: 
  - `limit` (optional): Number of menu items to return (default: 10)
- **Description**: Returns detailed information about menu items, allergens, and sub-cuisines.
- **Response**: Menu items with their allergens, all allergens, and all sub-cuisines.

### Get Recommendations
- **URL**: `/api/food-recommendations`
- **Method**: GET
- **Parameters**: 
  - `profileId` (required): The ID of the profile to get recommendations for
  - `page` (optional): Page number for pagination (default: 1)
  - `pageSize` (optional): Number of items per page (default: 10)
  - `sort` (optional): Sort field and direction (default: 'item_name:asc')
  - `cuisine` (optional): ID of the cuisine to filter by
- **Description**: Returns food recommendations based on the user's allergies.
- **Response**: Menu items that don't contain allergens the user is allergic to.

### Get Recommendations by Cuisine
- **URL**: `/api/food-recommendations/by-cuisine`
- **Method**: GET
- **Parameters**: 
  - `profileId` (required): The ID of the profile to get recommendations for
  - `cuisineId` (required): The ID of the cuisine to filter by
  - `page` (optional): Page number for pagination (default: 1)
  - `pageSize` (optional): Number of items per page (default: 10)
  - `sort` (optional): Sort field and direction (default: 'item_name:asc')
- **Description**: Returns food recommendations filtered by cuisine.
- **Response**: Menu items from the specified cuisine that don't contain allergens the user is allergic to.

### Get Popular Recommendations
- **URL**: `/api/food-recommendations/popular`
- **Method**: GET
- **Parameters**: 
  - `profileId` (required): The ID of the profile to get recommendations for
  - `page` (optional): Page number for pagination (default: 1)
  - `pageSize` (optional): Number of items per page (default: 10)
- **Description**: Returns popular food recommendations based on restaurant ratings.
- **Response**: Menu items sorted by restaurant rating that don't contain allergens the user is allergic to.

## Debugging

If you're having issues with the food recommendation API, follow these steps:

1. Check if the API is working correctly using the test endpoint.
2. Use the debug profile endpoint to check if the profile and its allergies are correctly configured.
3. Use the debug menu items endpoint to check if menu items have allergens assigned.
4. Check the server logs for detailed information about the API calls.

## Populating Menu Item Allergens

If menu items don't have allergens assigned, you can use the script at `scripts/populate-menu-item-allergens.js` to automatically assign allergens based on menu item descriptions:

```bash
node scripts/populate-menu-item-allergens.js
```

This script will:
1. Fetch all menu items and allergies
2. For each menu item, check if its description contains any allergy names
3. If it does, add the allergy to the menu item's allergens 