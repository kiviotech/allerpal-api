// Test IMAP connection to Gmail
require('dotenv').config();
const imaps = require('imap-simple');

async function testImapConnection() {
  console.log('Starting IMAP connection test...');
  
  const config = {
    imap: {
      user: process.env.SMTP_USERNAME,
      password: process.env.SMTP_PASSWORD,
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993', 10),
      tls: true,
      tlsOptions: { 
        rejectUnauthorized: true,
        servername: process.env.IMAP_HOST || 'imap.gmail.com'
      },
      authTimeout: 30000,
      connTimeout: 45000,
      socketTimeout: 60000
    }
  };
  
  console.log('Using IMAP configuration:', {
    host: config.imap.host,
    port: config.imap.port,
    user: config.imap.user,
    tls: config.imap.tls,
  });
  
  let connection = null;
  
  try {
    console.log('Connecting to IMAP server...');
    connection = await imaps.connect(config);
    console.log('Connection established successfully!');
    
    // Open the inbox
    await connection.openBox('INBOX');
    console.log('INBOX opened successfully!');
    
    // Get unread emails from last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    console.log('Searching for unread emails from last 24 hours...');
    const messages = await connection.search(['UNSEEN', ['SINCE', yesterday]], {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false
    });
    
    console.log(`Found ${messages.length} unread emails from last 24 hours`);
    
    // Close the connection
    await connection.end();
    console.log('Connection closed successfully');
    
    return {
      success: true,
      messageCount: messages.length
    };
  } catch (error) {
    console.error('IMAP connection test failed:', error);
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      source: error.source,
      code: error.code
    });
    
    // Attempt to close the connection if it exists
    if (connection) {
      try {
        await connection.end();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
    
    return {
      success: false,
      error: error.message,
      errorDetails: {
        type: error.type,
        source: error.source,
        code: error.code
      }
    };
  }
}

// Run the test
testImapConnection()
  .then(result => {
    console.log('IMAP Connection Test Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running IMAP connection test:', error);
    process.exit(1);
  }); 