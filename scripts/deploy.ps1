# Time Tracker Deployment Script for Windows
param(
    [switch]$SkipBuild = $false,
    [switch]$SkipMigrations = $false
)

Write-Host "🚀 Starting Time Tracker deployment..." -ForegroundColor Green

# Check if required environment variables are set
$requiredVars = @("DATABASE_URL", "REDIS_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "SESSION_SECRET")
foreach ($var in $requiredVars) {
    if (-not (Get-Variable -Name $var -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Error: $var environment variable is not set" -ForegroundColor Red
        exit 1
    }
}

try {
    if (-not $SkipBuild) {
        # Build client application
        Write-Host "📦 Building client application..." -ForegroundColor Yellow
        Set-Location "packages/client"
        npm run build
        Set-Location "../.."

        # Build server application
        Write-Host "📦 Building server application..." -ForegroundColor Yellow
        Set-Location "packages/server"
        npm run build
        Set-Location "../.."
    }

    if (-not $SkipMigrations) {
        # Run database migrations
        Write-Host "🗄️ Running database migrations..." -ForegroundColor Yellow
        Set-Location "packages/server"
        npm run migrate
        Set-Location "../.."
    }

    # Stop existing containers
    Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml down

    # Pull latest images
    Write-Host "📥 Pulling latest images..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml pull

    # Start services
    Write-Host "🚀 Starting services..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
    $timeout = 300
    $elapsed = 0
    
    while ($elapsed -lt $timeout) {
        $status = docker-compose -f docker-compose.prod.yml ps
        if ($status -match "healthy") {
            Write-Host "✅ Services are healthy!" -ForegroundColor Green
            break
        }
        Start-Sleep -Seconds 5
        $elapsed += 5
    }

    if ($elapsed -ge $timeout) {
        Write-Host "❌ Services failed to become healthy within $timeout seconds" -ForegroundColor Red
        docker-compose -f docker-compose.prod.yml logs
        exit 1
    }

    # Run health checks
    Write-Host "🏥 Running health checks..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Application health check passed" -ForegroundColor Green
        } else {
            throw "Health check returned status code: $($response.StatusCode)"
        }
    } catch {
        Write-Host "❌ Application health check failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    # Clean up old images
    Write-Host "🧹 Cleaning up old images..." -ForegroundColor Yellow
    docker image prune -f

    Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
    Write-Host "📊 Application is available at: http://localhost" -ForegroundColor Cyan
    Write-Host "📈 Monitoring is available at: http://localhost:3000 (Grafana)" -ForegroundColor Cyan
    Write-Host "📊 Metrics are available at: http://localhost:9090 (Prometheus)" -ForegroundColor Cyan

} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}