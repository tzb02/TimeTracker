# Time Tracker Deployment Guide

This guide covers deploying the Time Tracker application in production environments.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+
- Redis 7+
- SSL certificates (for HTTPS)

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/timetracker
POSTGRES_DB=timetracker
POSTGRES_USER=timetracker
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# JWT Secrets
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here
SESSION_SECRET=your_session_secret_here

# CORS
CORS_ORIGIN=https://yourdomain.com

# Monitoring
GRAFANA_PASSWORD=your_grafana_password
```

## Production Deployment

### Using Docker Compose

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy using the script:**
   ```bash
   # Linux/Mac
   ./scripts/deploy.sh
   
   # Windows
   .\scripts\deploy.ps1
   ```

3. **Or deploy manually:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Manual Deployment

1. **Build client:**
   ```bash
   cd packages/client
   npm install
   npm run build
   ```

2. **Build server:**
   ```bash
   cd packages/server
   npm install
   npm run build
   ```

3. **Run migrations:**
   ```bash
   cd packages/server
   npm run migrate
   ```

4. **Start services:**
   ```bash
   # Start PostgreSQL and Redis
   # Start the server
   cd packages/server
   npm start
   
   # Serve client files with nginx or similar
   ```

## SSL Configuration

1. **Obtain SSL certificates** (Let's Encrypt recommended):
   ```bash
   certbot certonly --webroot -w /var/www/html -d yourdomain.com
   ```

2. **Update nginx configuration** in `nginx/nginx.conf`:
   ```nginx
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       
       # ... rest of configuration
   }
   ```

## Monitoring Setup

The deployment includes Prometheus and Grafana for monitoring:

- **Grafana Dashboard:** http://localhost:3000
- **Prometheus Metrics:** http://localhost:9090

### Key Metrics to Monitor

- Response times
- Error rates
- Database connection pool
- Memory usage
- Timer accuracy
- User sessions

## Health Checks

The application provides health check endpoints:

- **Application:** `/health`
- **Database:** Included in health check
- **Redis:** Included in health check

## Backup Strategy

### Database Backups

```bash
# Daily backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/timetracker_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "timetracker_*.sql.gz" -mtime +30 -delete
```

### Redis Backups

Redis automatically creates RDB snapshots. Configure in `redis.conf`:

```
save 900 1
save 300 10
save 60 10000
```

## Security Considerations

1. **Use HTTPS in production**
2. **Set secure environment variables**
3. **Configure firewall rules**
4. **Regular security updates**
5. **Monitor for suspicious activity**

## Performance Optimization

1. **Enable gzip compression** (configured in nginx)
2. **Use CDN for static assets**
3. **Configure database connection pooling**
4. **Enable Redis caching**
5. **Monitor and optimize slow queries**

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   - Check DATABASE_URL format
   - Verify PostgreSQL is running
   - Check network connectivity

2. **Redis connection errors:**
   - Verify Redis is running
   - Check REDIS_URL format
   - Verify authentication

3. **JWT token errors:**
   - Check JWT_SECRET is set
   - Verify token expiration settings

4. **CORS errors:**
   - Update CORS_ORIGIN setting
   - Check nginx proxy configuration

### Logs

View application logs:
```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f

# Individual service logs
docker-compose -f docker-compose.prod.yml logs -f server
docker-compose -f docker-compose.prod.yml logs -f postgres
```

## Scaling

### Horizontal Scaling

1. **Load balancer configuration**
2. **Multiple server instances**
3. **Shared Redis for sessions**
4. **Database read replicas**

### Vertical Scaling

1. **Increase server resources**
2. **Optimize database queries**
3. **Tune connection pools**
4. **Monitor resource usage**

## Maintenance

### Regular Tasks

1. **Update dependencies**
2. **Apply security patches**
3. **Monitor disk space**
4. **Review logs for errors**
5. **Test backup restoration**

### Database Maintenance

```bash
# Analyze and vacuum
psql $DATABASE_URL -c "ANALYZE; VACUUM;"

# Reindex if needed
psql $DATABASE_URL -c "REINDEX DATABASE timetracker;"
```

## Support

For deployment issues:

1. Check logs first
2. Verify environment variables
3. Test health endpoints
4. Review monitoring dashboards
5. Check resource usage