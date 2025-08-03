# Production Environment Configuration

This guide covers setting up external services and environment variables for production deployment.

## Database Setup Options

### Option 1: Neon (Recommended)

**Why Neon?**
- Serverless PostgreSQL with automatic scaling
- Generous free tier
- Built-in connection pooling
- Excellent Vercel integration

**Setup Steps:**
1. Go to [neon.tech](https://neon.tech)
2. Sign up and create a new project
3. Choose region closest to your users
4. Copy the connection string from the dashboard
5. Format: `postgresql://username:password@host/database?sslmode=require`

**Configuration:**
```bash
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Option 2: Supabase

**Setup Steps:**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your actual password

**Configuration:**
```bash
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

### Option 3: Railway

**Setup Steps:**
1. Go to [railway.app](https://railway.app)
2. Create a new project
3. Add PostgreSQL service
4. Copy connection string from Variables tab

**Configuration:**
```bash
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

## Redis Setup Options

### Option 1: Upstash (Recommended)

**Why Upstash?**
- Serverless Redis with per-request pricing
- Global edge locations
- REST API support
- Excellent for serverless functions

**Setup Steps:**
1. Go to [upstash.com](https://upstash.com)
2. Create account and new Redis database
3. Choose region closest to your Vercel deployment
4. Copy the Redis URL from dashboard

**Configuration:**
```bash
REDIS_URL=rediss://default:password@xxx.upstash.io:6379
```

### Option 2: Railway Redis

**Setup Steps:**
1. In your Railway project
2. Add Redis service
3. Copy connection URL from Variables

**Configuration:**
```bash
REDIS_URL=redis://default:password@containers-us-west-xxx.railway.app:6379
```

## Environment Variables

### Backend Environment Variables

Create these in your Vercel backend project:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_DB=timetracker
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_secure_password

# Redis Configuration
REDIS_URL=redis://username:password@host:port

# JWT Configuration (Generate strong random strings)
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_minimum_32_characters
SESSION_SECRET=your_super_secure_session_secret_minimum_32_characters

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.vercel.app

# Application Configuration
NODE_ENV=production
PORT=3000

# Optional: Monitoring and Logging
LOG_LEVEL=info
GRAFANA_PASSWORD=your_grafana_password
```

### Frontend Environment Variables

Create these in your Vercel frontend project:

```bash
# API Configuration
VITE_API_URL=https://your-backend-domain.vercel.app

# Application Configuration
NODE_ENV=production
VITE_APP_NAME=Time Tracker
VITE_APP_VERSION=1.0.0

# Optional: Analytics
VITE_ANALYTICS_ID=your_analytics_id
```

## Security Best Practices

### JWT Secrets Generation

Generate strong secrets using Node.js:

```javascript
// Run this in Node.js console
const crypto = require('crypto');

console.log('JWT_SECRET:', crypto.randomBytes(64).toString('hex'));
console.log('JWT_REFRESH_SECRET:', crypto.randomBytes(64).toString('hex'));
console.log('SESSION_SECRET:', crypto.randomBytes(64).toString('hex'));
```

Or use online tools:
- [Generate Random](https://generate-random.org/api-key-generator)
- [Random.org](https://www.random.org/strings/)

### Database Security

1. **Use SSL connections** (included in connection strings above)
2. **Restrict IP access** if possible
3. **Use strong passwords** (minimum 16 characters)
4. **Enable connection pooling**
5. **Regular backups** (most services provide automatic backups)

### Redis Security

1. **Use AUTH** (password authentication)
2. **Enable SSL/TLS** (use `rediss://` protocol)
3. **Restrict access** to your application only
4. **Monitor usage** to detect anomalies

## Performance Configuration

### Database Optimization

```bash
# Connection pooling (if supported)
DATABASE_POOL_SIZE=10
DATABASE_POOL_TIMEOUT=30000

# Query timeout
DATABASE_QUERY_TIMEOUT=10000
```

### Redis Optimization

```bash
# Connection settings
REDIS_CONNECT_TIMEOUT=5000
REDIS_COMMAND_TIMEOUT=3000

# Memory optimization
REDIS_MAX_MEMORY_POLICY=allkeys-lru
```

### Application Performance

```bash
# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Session configuration
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_SAME_SITE=strict
```

## Monitoring and Logging

### Application Monitoring

```bash
# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Error tracking (if using Sentry)
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production

# Performance monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Health Check Configuration

```bash
# Health check settings
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_INTERVAL=30000

# Database health check
DB_HEALTH_CHECK_QUERY=SELECT 1
DB_HEALTH_CHECK_TIMEOUT=3000

# Redis health check
REDIS_HEALTH_CHECK_TIMEOUT=3000
```

## Backup and Recovery

### Database Backups

Most managed database services provide automatic backups:

- **Neon**: Automatic point-in-time recovery
- **Supabase**: Daily backups with 7-day retention
- **Railway**: Automatic backups available

### Manual Backup Script

```bash
#!/bin/bash
# Create manual backup
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql

# Upload to cloud storage (optional)
# aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
```

### Redis Persistence

Configure Redis persistence in your provider:

- **Upstash**: Automatic persistence enabled
- **Railway**: Configure RDB snapshots

## Scaling Considerations

### Database Scaling

1. **Connection Pooling**: Essential for serverless functions
2. **Read Replicas**: For high-read workloads
3. **Query Optimization**: Monitor slow queries
4. **Indexing**: Ensure proper indexes on frequently queried columns

### Redis Scaling

1. **Memory Management**: Monitor memory usage
2. **Eviction Policies**: Configure appropriate eviction
3. **Clustering**: For high-throughput applications
4. **Caching Strategy**: Implement proper cache invalidation

### Application Scaling

1. **Serverless Functions**: Automatic scaling with Vercel
2. **Cold Starts**: Minimize by keeping functions warm
3. **Bundle Size**: Optimize to reduce cold start time
4. **Database Connections**: Use connection pooling

## Cost Optimization

### Database Costs

- **Neon**: Pay for compute time and storage
- **Supabase**: Free tier up to 500MB, then pay for usage
- **Railway**: Pay for resources used

### Redis Costs

- **Upstash**: Pay per request (very cost-effective for low usage)
- **Railway**: Pay for memory allocation

### Vercel Costs

- **Functions**: 100GB-hours free, then pay per GB-hour
- **Bandwidth**: 100GB free, then pay per GB
- **Build Time**: 6,000 minutes free, then pay per minute

## Troubleshooting

### Common Database Issues

1. **Connection Timeouts**
   - Check connection string format
   - Verify network connectivity
   - Increase timeout values

2. **Too Many Connections**
   - Implement connection pooling
   - Monitor connection usage
   - Use connection limits

3. **Slow Queries**
   - Add database indexes
   - Optimize query structure
   - Monitor query performance

### Common Redis Issues

1. **Connection Failures**
   - Verify Redis URL format
   - Check authentication credentials
   - Test connectivity

2. **Memory Issues**
   - Monitor memory usage
   - Configure eviction policies
   - Optimize data structures

3. **Performance Issues**
   - Use pipelining for bulk operations
   - Implement proper caching strategies
   - Monitor command latency

This configuration guide ensures your production environment is secure, performant, and scalable.