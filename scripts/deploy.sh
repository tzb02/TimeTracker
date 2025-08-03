#!/bin/bash

# Time Tracker Deployment Script
set -e

echo "🚀 Starting Time Tracker deployment..."

# Check if required environment variables are set
required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET" "JWT_REFRESH_SECRET" "SESSION_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var environment variable is not set"
        exit 1
    fi
done

# Build client application
echo "📦 Building client application..."
cd packages/client
npm run build
cd ../..

# Build server application
echo "📦 Building server application..."
cd packages/server
npm run build
cd ../..

# Run database migrations
echo "🗄️ Running database migrations..."
cd packages/server
npm run migrate
cd ../..

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout=300
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
        echo "✅ Services are healthy!"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
done

if [ $elapsed -ge $timeout ]; then
    echo "❌ Services failed to become healthy within $timeout seconds"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Run health checks
echo "🏥 Running health checks..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Application health check passed"
else
    echo "❌ Application health check failed"
    exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "🎉 Deployment completed successfully!"
echo "📊 Application is available at: http://localhost"
echo "📈 Monitoring is available at: http://localhost:3000 (Grafana)"
echo "📊 Metrics are available at: http://localhost:9090 (Prometheus)"