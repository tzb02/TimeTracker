import { DatabaseConnection, DatabaseConfig } from '../connection';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
      release: jest.fn(),
    }),
    query: jest.fn().mockResolvedValue({ rows: [{ health: 1 }] }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}));

// Mock migrator
jest.mock('../migrator', () => ({
  DatabaseMigrator: jest.fn().mockImplementation(() => ({
    migrate: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('DatabaseConnection', () => {
  let dbConnection: DatabaseConnection;
  let mockConfig: DatabaseConfig;

  beforeEach(() => {
    mockConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test',
      username: 'test',
      password: 'test',
    };
    
    dbConnection = new DatabaseConnection(mockConfig);
  });

  describe('connect', () => {
    it('should connect successfully and run migrations', async () => {
      await expect(dbConnection.connect()).resolves.not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy connection', async () => {
      await dbConnection.connect();
      const isHealthy = await dbConnection.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('getPool', () => {
    it('should throw error if not connected', () => {
      expect(() => dbConnection.getPool()).toThrow('Database not connected');
    });

    it('should return pool if connected', async () => {
      await dbConnection.connect();
      expect(dbConnection.getPool()).toBeDefined();
    });
  });

  describe('query', () => {
    it('should throw error if not connected', async () => {
      await expect(dbConnection.query('SELECT 1')).rejects.toThrow('Database not connected');
    });

    it('should execute query if connected', async () => {
      await dbConnection.connect();
      const result = await dbConnection.query('SELECT 1');
      expect(result).toBeDefined();
    });
  });
});