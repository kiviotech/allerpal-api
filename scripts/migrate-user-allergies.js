/**
 * Migration script to move allergies from user-allergy to profile-allergy
 * 
 * This script:
 * 1. Finds all users with user-allergy records
 * 2. For each user, finds or creates a "myself" profile
 * 3. Creates a profile-allergy record for this profile
 * 4. Copies all allergies from user-allergy to profile-allergy
 * 
 * Run with: node scripts/migrate-user-allergies.js
 */

const Strapi = require('@strapi/strapi');

async function migrateUserAllergies() {
  try {
    // Start Strapi
    console.log('Starting Strapi...');
    const strapi = await Strapi().load();
    console.log('Strapi started successfully');

    // Get all users with user-allergy records
    console.log('Fetching users with user-allergy records...');
    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: {
        user_allergy: {
          id: {
            $notNull: true,
          },
        },
      },
      populate: ['user_allergy.allergies'],
    });
    console.log(`Found ${users.length} users with user-allergy records`);

    // Process each user
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      console.log(`\nProcessing user: ${user.username} (ID: ${user.id})`);
      
      try {
        // Check if user has allergies
        if (!user.user_allergy || !user.user_allergy.allergies || user.user_allergy.allergies.length === 0) {
          console.log(`  User has no allergies, skipping`);
          skippedCount++;
          continue;
        }

        // Find or create a "myself" profile for this user
        let profile = await strapi.db.query('api::profile.profile').findOne({
          where: {
            user: user.id,
            relation: 'myself',
          },
        });

        if (!profile) {
          console.log(`  Creating "myself" profile for user ${user.username}`);
          profile = await strapi.entityService.create('api::profile.profile', {
            data: {
              name: user.username,
              relation: 'myself',
              user: user.id,
            },
          });
          console.log(`  Created profile with ID: ${profile.id}`);
        } else {
          console.log(`  Found existing "myself" profile with ID: ${profile.id}`);
        }

        // Check if profile already has a profile-allergy record
        const existingProfileAllergy = await strapi.db.query('api::profile-allergy.profile-allergy').findOne({
          where: {
            profile: profile.id,
          },
          populate: ['allergies'],
        });

        if (existingProfileAllergy) {
          console.log(`  Profile already has a profile-allergy record with ID: ${existingProfileAllergy.id}`);
          
          // Get existing allergy IDs
          const existingAllergyIds = existingProfileAllergy.allergies.map(a => a.id);
          
          // Get user allergy IDs
          const userAllergyIds = user.user_allergy.allergies.map(a => a.id);
          
          // Find new allergies to add
          const newAllergyIds = userAllergyIds.filter(id => !existingAllergyIds.includes(id));
          
          if (newAllergyIds.length > 0) {
            console.log(`  Adding ${newAllergyIds.length} new allergies to existing profile-allergy`);
            
            // Update profile-allergy with new allergies
            await strapi.entityService.update('api::profile-allergy.profile-allergy', existingProfileAllergy.id, {
              data: {
                allergies: [...existingAllergyIds, ...newAllergyIds],
              },
            });
            
            console.log(`  Updated profile-allergy with new allergies`);
            migratedCount++;
          } else {
            console.log(`  No new allergies to add, skipping`);
            skippedCount++;
          }
        } else {
          console.log(`  Creating new profile-allergy record for profile ${profile.id}`);
          
          // Create a new profile-allergy record
          const profileAllergy = await strapi.entityService.create('api::profile-allergy.profile-allergy', {
            data: {
              profile: profile.id,
              severity: 'mild', // Default severity
              allergies: user.user_allergy.allergies.map(a => a.id),
              excludeMayContain: false, // Default value
            },
          });
          
          console.log(`  Created profile-allergy with ID: ${profileAllergy.id}`);
          migratedCount++;
        }
      } catch (error) {
        console.error(`  Error processing user ${user.username}:`, error);
        errorCount++;
      }
    }

    console.log('\nMigration summary:');
    console.log(`  Migrated: ${migratedCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Total processed: ${users.length}`);

    // Stop Strapi
    console.log('\nStopping Strapi...');
    await strapi.destroy();
    console.log('Strapi stopped successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateUserAllergies(); 