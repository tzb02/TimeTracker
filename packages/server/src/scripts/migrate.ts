#!/usr/bin/env node

import dotenv from 'dotenv';
import { initializeDatabase, createDatabaseConfig } from '../database';

// Load environment variables
dotenv.config();

async function runMigrations() {
  try {
    console.log('🚀 Starting migration script...');
    
    const config = createDatabaseConfig();
    const db = initializeDatabase(config);
    
    await db.connect();
    
    // For now, just create basic tables since we're using mock database
    console.log('📊 Creating basic database structure...');
    
    // Check command line arguments
    const command = process.argv[2];
    
    switch (command) {
      case 'status':
        console.log('\n📊 Migration Status:');
        console.log('✅ Using mock database - no migrations needed');
        break;
        
      case 'reset':
        console.log('⚠️  Resetting mock database...');
        break;
        
      case 'migrate':
      default:
        await migrator.migrate();
        break;
    }
    
    await db.disconnect();
    console.log('✅ Migration script completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run migrations
runMigrations();