# Database Module

This module provides database connectivity, migrations, and utilities for the Web Time Tracker application.

## Features

- PostgreSQL connection management with connection pooling
- Database migration system with rollback support
- TypeScript interfaces for all data models
- Utility functions for data mapping and query building
- Health checks and graceful shutdown handling

## Setup

1. Copy the environment example file:
```bash
cp .env.example .env
```

2. Update the database configuration in `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=timetracker
DB_USER=postgres
DB_PASSWORD=password
```

3. Run migrations:
```bash
npm run migrate
```

## Usage

### Basic Connection

```typescript
import { initializeDatabase, createDatabaseConfig } from './database';

// Initialize database
const config = createDatabaseConfig();
const db = initializeDatabase(config);
await db.connect();

// Use the database
const result = await db.query('SELECT * FROM users');
```

### Using Models

```typescript
import { User, Project, TimeEntry } from './database';

// Type-safe data models
const user: User = {
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
  // ... other properties
};
```

### Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Reset database (WARNING: deletes all data)
npm run migrate:reset
```

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (VARCHAR, Unique)
- `name` (VARCHAR)
- `password_hash` (VARCHAR)
- `organization_id` (UUID, Optional)
- `role` (VARCHAR: 'admin' | 'user')
- `preferences` (JSONB)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Projects Table
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `color` (VARCHAR, Hex color)
- `description` (TEXT, Optional)
- `user_id` (UUID, Foreign Key)
- `is_active` (BOOLEAN)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Time Entries Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `project_id` (UUID, Foreign Key)
- `description` (TEXT)
- `start_time` (TIMESTAMP)
- `end_time` (TIMESTAMP, Optional)
- `duration` (INTEGER, seconds)
- `is_running` (BOOLEAN)
- `tags` (TEXT[])
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Constraints

- Only one running timer per user (enforced by unique index)
- End time must be after start time
- Duration must be non-negative
- Cascade delete for user-related data

## Testing

```bash
# Run database tests
npm test -- --testPathPattern=database

# Run specific test file
npm test -- --testPathPattern=utils.test.ts
```

## Utilities

The module includes several utility functions:

- **Data Mapping**: Convert between database rows and TypeScript models
- **Query Building**: Dynamic WHERE and UPDATE clause generation
- **Validation**: UUID validation and data integrity checks
- **Time Calculations**: Duration calculations and formatting

## Error Handling

The database module includes comprehensive error handling:

- Connection failures with retry logic
- Transaction rollbacks on errors
- Graceful shutdown handling
- Migration failure recovery

## Performance Considerations

- Connection pooling for efficient resource usage
- Proper database indexing for query performance
- Prepared statements to prevent SQL injection
- Transaction support for data consistency