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
    
    const migrator = db.getMigrator();
    
    // Check command line arguments
    const command = process.argv[2];
    
    switch (command) {
      case 'status':
        const status = await migrator.getStatus();
        console.log('\n📊 Migration Status:');
        console.log(`✅ Executed: ${status.executed.length}`);
        status.executed.forEach(migration => console.log(`  - ${migration}`));
        console.log(`⏳ Pending: ${status.pending.length}`);
        status.pending.forEach(migration => console.log(`  - ${migration}`));
        break;
        
      case 'reset':
        console.log('⚠️  This will delete all data! Are you sure? (This action cannot be undone)');
        await migrator.reset();
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