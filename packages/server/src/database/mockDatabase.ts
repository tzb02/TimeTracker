import { DatabaseConnection } from './connection';

interface MockTable {
  [key: string]: any[];
}

/**
 * Mock database implementation for development when PostgreSQL is not available
 */
export class MockDatabase implements DatabaseConnection {
  private tables: MockTable = {
    users: [],
    projects: [],
    time_entries: [],
    refresh_tokens: [],
  };
  private connected = false;

  async connect(): Promise<void> {
    console.log('📦 Using mock database (PostgreSQL not available)');
    this.connected = true;
    
    // Initialize with some sample data
    this.initializeSampleData();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('📦 Mock database disconnected');
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    // Simple mock query implementation
    // This is a very basic implementation for development purposes
    console.log('Mock DB Query:', text, params);
    
    // Handle SELECT queries
    if (text.toLowerCase().includes('select')) {
      if (text.includes('users')) {
        return { rows: this.tables.users, rowCount: this.tables.users.length };
      }
      if (text.includes('projects')) {
        return { rows: this.tables.projects, rowCount: this.tables.projects.length };
      }
      if (text.includes('time_entries')) {
        return { rows: this.tables.time_entries, rowCount: this.tables.time_entries.length };
      }
      return { rows: [], rowCount: 0 };
    }

    // Handle INSERT queries
    if (text.toLowerCase().includes('insert')) {
      const id = Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString();
      
      if (text.includes('users')) {
        const user = {
          id,
          email: params?.[0] || 'test@example.com',
          name: params?.[1] || 'Test User',
          password_hash: params?.[2] || 'hashed_password',
          role: 'user',
          preferences: JSON.stringify({
            timeFormat: '24h',
            weekStartDay: 1,
            notifications: true
          }),
          created_at: now,
          updated_at: now,
        };
        this.tables.users.push(user);
        return { rows: [user], rowCount: 1 };
      }
      
      if (text.includes('projects')) {
        const project = {
          id,
          name: params?.[0] || 'Sample Project',
          color: params?.[1] || '#3B82F6',
          description: params?.[2] || '',
          user_id: params?.[3] || 'user1',
          is_active: true,
          created_at: now,
          updated_at: now,
        };
        this.tables.projects.push(project);
        return { rows: [project], rowCount: 1 };
      }
      
      return { rows: [{ id }], rowCount: 1 };
    }

    // Handle UPDATE queries
    if (text.toLowerCase().includes('update')) {
      return { rows: [], rowCount: 1 };
    }

    // Handle DELETE queries
    if (text.toLowerCase().includes('delete')) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    // Simple mock transaction - just execute the callback
    return callback(this);
  }

  private initializeSampleData(): void {
    // Add a sample user
    this.tables.users.push({
      id: 'user1',
      email: 'demo@example.com',
      name: 'Demo User',
      password_hash: '$2b$10$example_hash',
      role: 'user',
      preferences: JSON.stringify({
        timeFormat: '24h',
        weekStartDay: 1,
        notifications: true
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Add sample projects
    this.tables.projects.push(
      {
        id: 'project1',
        name: 'Sample Project',
        color: '#3B82F6',
        description: 'A sample project for testing',
        user_id: 'user1',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'project2',
        name: 'Another Project',
        color: '#10B981',
        description: 'Another sample project',
        user_id: 'user1',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    // Add sample time entries
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    this.tables.time_entries.push(
      {
        id: 'entry1',
        user_id: 'user1',
        project_id: 'project1',
        description: 'Working on sample task',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        duration: 3600,
        is_running: false,
        tags: JSON.stringify(['development']),
        created_at: oneHourAgo.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: 'entry2',
        user_id: 'user1',
        project_id: 'project2',
        description: 'Testing features',
        start_time: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        end_time: null,
        duration: 1800,
        is_running: true,
        tags: JSON.stringify(['testing']),
        created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        updated_at: now.toISOString(),
      }
    );
  }
}