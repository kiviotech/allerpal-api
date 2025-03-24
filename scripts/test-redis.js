'use strict';

const IORedis = require('ioredis');

async function testRedisConnection() {
  console.log('Testing Redis connection...');
  
  try {
    // Create Redis connection
    const connection = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    // Test the connection
    const pingResult = await connection.ping();
    console.log('Redis connection successful!');
    console.log('Ping result:', pingResult);

    // Set a test value
    await connection.set('test-key', 'Hello from AllerPal API!');
    console.log('Set test value in Redis');

    // Get the test value
    const testValue = await connection.get('test-key');
    console.log('Retrieved test value:', testValue);

    // Clean up
    await connection.del('test-key');
    console.log('Cleaned up test value');

    // Close the connection
    await connection.quit();
    console.log('Redis connection closed');
    
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

// Run the test
testRedisConnection()
  .then(success => {
    if (success) {
      console.log('Redis test completed successfully!');
      process.exit(0);
    } else {
      console.error('Redis test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error during Redis test:', error);
    process.exit(1);
  }); 