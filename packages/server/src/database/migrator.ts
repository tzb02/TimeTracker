import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export class DatabaseMigrator {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Initialize the migrations table if it doesn't exist
   */
  private async initializeMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await this.pool.query(query);
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT filename FROM migrations ORDER BY id'
    );
    return result.rows.map(row => row.filename);
  }

  /**
   * Get list of available migration files
   */
  private getMigrationFiles(): string[] {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      return [];
    }

    return fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  /**
   * Execute a single migration file
   */
  private async executeMigration(filename: string): Promise<void> {
    const migrationPath = path.join(__dirname, 'migrations', filename);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the migration
      await client.query(migrationSQL);
      
      // Record the migration as executed
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Migration ${filename} executed successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Migration ${filename} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      console.log('🔄 Starting database migrations...');
      
      await this.initializeMigrationsTable();
      
      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = this.getMigrationFiles();
      
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migrations:`);
      pendingMigrations.forEach(migration => console.log(`  - ${migration}`));

      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    executed: string[];
    pending: string[];
  }> {
    await this.initializeMigrationsTable();
    
    const executedMigrations = await this.getExecutedMigrations();
    const availableMigrations = this.getMigrationFiles();
    
    const pendingMigrations = availableMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );

    return {
      executed: executedMigrations,
      pending: pendingMigrations
    };
  }

  /**
   * Reset database (drop all tables and re-run migrations)
   * WARNING: This will delete all data!
   */
  async reset(): Promise<void> {
    console.log('⚠️  Resetting database - this will delete all data!');
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Drop all tables
      await client.query(`
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
      `);
      
      await client.query('COMMIT');
      console.log('🗑️  Database reset completed');
      
      // Re-run migrations
      await this.migrate();
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Database reset failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}