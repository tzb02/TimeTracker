import { Pool } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface Database {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  query(text: string, params?: any[]): Promise<any>;
}

class PostgreSQLDatabase implements Database {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    try {
      await this.pool.connect();
      console.log('✅ PostgreSQL connected successfully');
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('🔌 PostgreSQL disconnected');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }
}

class MockDatabase implements Database {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.log('✅ Mock database connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('🔌 Mock database disconnected');
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async query(text: string, params?: any[]): Promise<any> {
    console.log('Mock query:', text, params);
    return { rows: [], rowCount: 0 };
  }
}

let database: Database | null = null;

export function createDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'timetracker',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  };
}

export function initializeDatabase(config: DatabaseConfig): Database {
  database = new PostgreSQLDatabase(config);
  return database;
}

export function initializeMockDatabase(): Database {
  database = new MockDatabase();
  return database;
}

export function getDatabase(): Database {
  if (!database) {
    throw new Error('Database not initialized');
  }
  return database;
}