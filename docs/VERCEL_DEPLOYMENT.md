# Vercel Deployment Guide for Time Tracker

This guide provides step-by-step instructions for deploying the Time Tracker application to Vercel.

## Overview

The Time Tracker is a monorepo with:
- **Frontend**: React + Vite (`packages/client`)
- **Backend**: Express.js API (`packages/server`)
- **Database**: PostgreSQL (external service required)
- **Cache**: Redis (external service required)

## Deployment Strategy

We'll use **two separate Vercel projects**:
1. **Frontend**: Static site deployment for the React app
2. **Backend**: Serverless functions for the API

## Prerequisites

1. Vercel account
2. GitHub repository
3. External PostgreSQL database (Neon, Supabase, or Railway)
4. External Redis instance (Upstash or Railway)

## Step 1: Create Required Configuration Files

### 1.1 Root `vercel.json` (for Frontend)

Create `vercel.json` in the project root:

```json
{
  "version": 2,
  "name": "time-tracker-frontend",
  "buildCommand": "cd packages/client && npm run build",
  "outputDirectory": "packages/client/dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-backend-domain.vercel.app/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 1.2 Backend `vercel.json`

Create `packages/server/vercel.json`:

```json
{
  "version": 2,
  "name": "time-tracker-backend",
  "builds": [
    {
      "src": "src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 1.3 Update Client API Configuration

Update `packages/client/src/lib/api.ts`:

```typescript
// Add environment-based API URL
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-backend-domain.vercel.app/api'
  : '/api';

// Update the axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});
```

### 1.4 Update Vite Configuration

Update `packages/client/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          query: ['@tanstack/react-query'],
          ui: ['lucide-react'],
          utils: ['date-fns', 'clsx'],
          stores: ['zustand'],
        },
      },
    },
  },
});
```

## Step 2: Set Up External Services

### 2.1 PostgreSQL Database

**Option A: Neon (Recommended)**
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

**Option B: Supabase**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database
4. Copy the connection string

**Option C: Railway**
1. Go to [railway.app](https://railway.app)
2. Create a PostgreSQL service
3. Copy the connection string

### 2.2 Redis Cache

**Option A: Upstash (Recommended)**
1. Go to [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the connection URL

**Option B: Railway**
1. Go to [railway.app](https://railway.app)
2. Create a Redis service
3. Copy the connection URL

## Step 3: Deploy Backend to Vercel

### 3.1 Create Backend Project

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Choose "Other" framework
5. Set root directory to `packages/server`
6. Override build command: `npm run build`
7. Override output directory: `dist`

### 3.2 Configure Environment Variables

Add these environment variables in Vercel dashboard:

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_DB=timetracker
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password

# Redis
REDIS_URL=redis://username:password@host:port

# JWT Secrets (generate strong random strings)
JWT_SECRET=your_super_secure_jwt_secret_here
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_here
SESSION_SECRET=your_super_secure_session_secret_here

# CORS
CORS_ORIGIN=https://your-frontend-domain.vercel.app

# Node Environment
NODE_ENV=production

# Optional: Monitoring
GRAFANA_PASSWORD=your_grafana_password
```

### 3.3 Deploy Backend

1. Click "Deploy"
2. Wait for deployment to complete
3. Note the deployment URL (e.g., `https://time-tracker-backend.vercel.app`)

## Step 4: Deploy Frontend to Vercel

### 4.1 Create Frontend Project

1. Create a new Vercel project
2. Import the same GitHub repository
3. Choose "Vite" framework
4. Set root directory to `packages/client`
5. Override build command: `npm run build`
6. Override output directory: `dist`

### 4.2 Configure Environment Variables

Add these environment variables:

```bash
# API URL (use your backend deployment URL)
VITE_API_URL=https://your-backend-domain.vercel.app

# Environment
NODE_ENV=production
```

### 4.3 Update Frontend Configuration

Before deploying, update the root `vercel.json` with your actual backend URL:

```json
{
  "version": 2,
  "name": "time-tracker-frontend",
  "buildCommand": "cd packages/client && npm run build",
  "outputDirectory": "packages/client/dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-actual-backend-domain.vercel.app/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 4.4 Deploy Frontend

1. Click "Deploy"
2. Wait for deployment to complete
3. Note the deployment URL

## Step 5: Update CORS Configuration

Update the backend's CORS_ORIGIN environment variable with your frontend URL:

```bash
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

## Step 6: Database Migration

### 6.1 Run Migrations

You'll need to run database migrations manually. You can do this locally:

```bash
# Set your production DATABASE_URL
export DATABASE_URL="your_production_database_url"

# Run migrations
cd packages/server
npm run migrate
```

### 6.2 Alternative: Migration Script

Create a one-time Vercel function for migrations by adding this to `packages/server/api/migrate.ts`:

```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { runMigrations } from '../src/database/migrations';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Add authentication check here
  const authToken = req.headers.authorization;
  if (authToken !== `Bearer ${process.env.MIGRATION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await runMigrations();
    res.status(200).json({ message: 'Migrations completed successfully' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
}
```

## Step 7: Testing

### 7.1 Test Backend

Visit your backend URL and test endpoints:
- `https://your-backend-domain.vercel.app/health`
- `https://your-backend-domain.vercel.app/api/auth/me`

### 7.2 Test Frontend

Visit your frontend URL and verify:
- Application loads correctly
- Login/registration forms work
- API calls are successful
- No CORS errors in console

## Step 8: Custom Domains (Optional)

### 8.1 Add Custom Domain to Backend

1. Go to your backend project in Vercel
2. Go to Settings > Domains
3. Add your API domain (e.g., `api.yourdomain.com`)

### 8.2 Add Custom Domain to Frontend

1. Go to your frontend project in Vercel
2. Go to Settings > Domains
3. Add your main domain (e.g., `yourdomain.com`)

### 8.3 Update Configuration

Update environment variables and configuration files with your custom domains.

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify CORS_ORIGIN matches your frontend URL exactly
   - Check that credentials are included in requests

2. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check that database allows connections from Vercel IPs
   - Ensure database is accessible from the internet

3. **Build Failures**
   - Check that all dependencies are in package.json
   - Verify TypeScript compilation succeeds locally
   - Check build logs for specific errors

4. **API Route Not Found**
   - Verify vercel.json routing configuration
   - Check that API endpoints are correctly defined
   - Ensure backend deployment was successful

### Monitoring

Set up monitoring for your production deployment:

1. **Vercel Analytics**: Enable in project settings
2. **Error Tracking**: Consider Sentry integration
3. **Uptime Monitoring**: Use services like UptimeRobot
4. **Database Monitoring**: Use your database provider's monitoring

## Security Considerations

1. **Environment Variables**: Never commit secrets to git
2. **CORS**: Set specific origins, not wildcards
3. **Rate Limiting**: Ensure rate limiting is configured
4. **HTTPS**: Always use HTTPS in production
5. **Database Security**: Use connection pooling and SSL

## Performance Optimization

1. **CDN**: Vercel provides global CDN automatically
2. **Caching**: Configure appropriate cache headers
3. **Bundle Size**: Monitor and optimize bundle size
4. **Database**: Use connection pooling and query optimization
5. **Redis**: Implement proper caching strategies

## Maintenance

### Regular Tasks

1. **Monitor Logs**: Check Vercel function logs regularly
2. **Update Dependencies**: Keep packages up to date
3. **Database Maintenance**: Monitor database performance
4. **Backup Strategy**: Ensure regular database backups
5. **Security Updates**: Apply security patches promptly

### Scaling Considerations

1. **Function Limits**: Vercel has execution time limits
2. **Database Connections**: Monitor connection pool usage
3. **Redis Memory**: Monitor Redis memory usage
4. **Concurrent Users**: Plan for traffic spikes

This deployment guide provides a complete setup for production deployment on Vercel. Follow each step carefully and test thoroughly before going live.