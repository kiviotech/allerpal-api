# Restaurant Bulk Import System

This module provides functionality for bulk importing restaurants, menus, menu items, and allergens into the AllerPal system.

## Features

- Import data from Excel spreadsheets
- Import data from JSON payloads
- Validate data before importing (dry-run mode)
- Support for relationship mapping between entities
- Proper allergen handling and association
- Transaction support for all-or-nothing operations
- Detailed error and warning reporting

## API Endpoints

### Excel Import

- **POST /api/restaurant-import/upload**
  - Upload an Excel file with restaurant data
  - Query parameters:
    - `dryRun=true|false` - Validate without making changes (default: false)
    - `updateExisting=true|false` - Update existing records (default: true)

### JSON Import

- **POST /api/restaurant-import/import-json**
  - Import restaurant data from a JSON payload
  - Query parameters:
    - `dryRun=true|false` - Validate without making changes (default: false)
    - `updateExisting=true|false` - Update existing records (default: true)
    - `matchBy=email|name|id` - Field to use for matching existing records (default: email)

### Validation

- **POST /api/restaurant-import/validate**
  - Validate an Excel file without importing
  - Returns validation results and warnings

### Templates

- **GET /api/restaurant-import/download-template**
  - Download an Excel template for restaurant import

### Import Records

- **GET /api/restaurant-import/:id**
  - Get details of a specific import operation

- **GET /api/restaurant-import**
  - List all import operations
  - Supports filtering, sorting, and pagination

## Excel Template Format

The Excel template includes the following sheets:

1. **Restaurants** - Basic restaurant information
   - Name (required)
   - Email (required, used as unique identifier)
   - Location
   - Description
   - ContactNumber
   - Rating
   - ImageData (base64 encoded)

2. **Menus** - Menu types for each restaurant
   - Type (required, "normal" or "allergen")
   - RestaurantEmail (reference to restaurant)

3. **Allergens** - Allergen definitions
   - Name (required)
   - Description
   - IsCustom

4. **MenuItems** - Menu items with allergen associations
   - Name (required)
   - Description
   - Price
   - Available
   - Vegetarian
   - MenuType ("normal" or "allergen")
   - RestaurantEmail (reference to restaurant)
   - Allergens (comma-separated list of allergen names)
   - ImageData (base64 encoded)

## JSON Import Format

```json
{
  "importType": "restaurants",
  "version": "1.0",
  "options": {
    "updateExisting": true,
    "createMissing": true,
    "matchBy": "email"
  },
  "data": {
    "restaurants": [
      {
        "name": "Restaurant Name",
        "email": "restaurant@example.com",
        "location": "123 Main St, City",
        "description": "Restaurant description",
        "contact_number": "+1234567890",
        "rating": 4.5,
        "images": [
          {
            "name": "restaurant.jpg",
            "data": "base64_encoded_data",
            "type": "image/jpeg"
          }
        ],
        "menus": [
          {
            "type": "normal"
          },
          {
            "type": "allergen"
          }
        ],
        "menuItems": [
          {
            "item_name": "Menu Item 1",
            "description": "Item description",
            "price": 12.99,
            "is_available": true,
            "is_vegetarian": true,
            "menu_type": "normal",
            "images": [
              {
                "name": "item.jpg",
                "data": "base64_encoded_data",
                "type": "image/jpeg"
              }
            ],
            "allergens": [
              {
                "name": "Peanuts"
              },
              {
                "name": "Shellfish"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Testing the Import

You can use the provided `restaurant-import-tester.js` script to generate test data and send it to the API:

```bash
# Save a test payload to a file
node restaurant-import-tester.js --save

# Send a test payload to the API
node restaurant-import-tester.js --send

# Test in dry-run mode (validation only)
node restaurant-import-tester.js --send --dry-run
```

## Error Handling

The import system provides detailed error and warning messages for issues encountered during import:

- **Validation errors** - Issues that prevent importing (missing required fields, etc.)
- **Processing warnings** - Non-critical issues that don't prevent importing (unknown allergens, etc.)
- **Relationship warnings** - Issues with entity relationships (menu items with non-existent menus, etc.)

## Transaction Support

All operations use database transactions to ensure data consistency. If an error occurs during import, the entire operation is rolled back to prevent partial imports. 