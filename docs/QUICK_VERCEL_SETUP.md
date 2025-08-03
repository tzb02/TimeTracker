# Quick Vercel Setup Guide

This is a condensed guide for immediate Vercel deployment. For detailed explanations, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

## 1. Required Configuration Files

### Root `vercel.json` (Frontend)
```json
{
  "version": 2,
  "name": "time-tracker-frontend",
  "buildCommand": "cd packages/client && npx vite build",
  "outputDirectory": "packages/client/dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://YOUR_BACKEND_URL.vercel.app/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**IMPORTANT**: Use `npx vite build` instead of `npm run build` to avoid TypeScript compilation errors.

### `packages/server/vercel.json` (Backend)
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

## 2. Update Client API Configuration

In `packages/client/src/lib/api.ts`, update the API_BASE_URL:

```typescript
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://YOUR_BACKEND_URL.vercel.app/api'
  : '/api';
```

## 3. External Services Setup

### Database (Choose one):
- **Neon**: https://neon.tech (Recommended)
- **Supabase**: https://supabase.com
- **Railway**: https://railway.app

### Redis (Choose one):
- **Upstash**: https://upstash.com (Recommended)
- **Railway**: https://railway.app

## 4. Deploy Backend First

1. Create new Vercel project
2. Set root directory: `packages/server`
3. Framework: Other
4. Build command: `npm run build`
5. Output directory: `dist`

### Backend Environment Variables:
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://user:pass@host:port
JWT_SECRET=your_super_secure_jwt_secret
JWT_REFRESH_SECRET=your_super_secure_refresh_secret
SESSION_SECRET=your_super_secure_session_secret
CORS_ORIGIN=https://YOUR_FRONTEND_URL.vercel.app
NODE_ENV=production
```

## 5. Deploy Frontend Second

1. Create new Vercel project (same repo)
2. Set root directory: `packages/client`
3. Framework: Vite
4. Build command: `npx vite build`
5. Output directory: `dist`

### Frontend Environment Variables:
```bash
VITE_API_URL=https://YOUR_BACKEND_URL.vercel.app
NODE_ENV=production
```

## 6. Update Configuration

1. Update root `vercel.json` with actual backend URL
2. Update `packages/client/src/lib/api.ts` with actual backend URL
3. Update backend `CORS_ORIGIN` with actual frontend URL

## 7. Run Database Migrations

```bash
export DATABASE_URL="your_production_database_url"
cd packages/server
npm run migrate
```

## 8. Test Deployment

- Backend health: `https://your-backend.vercel.app/health`
- Frontend: `https://your-frontend.vercel.app`

## Common Issues

1. **CORS errors**: Check CORS_ORIGIN matches frontend URL exactly
2. **API not found**: Verify vercel.json routing and backend deployment
3. **Database errors**: Check DATABASE_URL format and connectivity
4. **Build failures**: Ensure all dependencies are in package.json

## Next Steps

- Set up custom domains
- Configure monitoring
- Set up automated backups
- Implement CI/CD pipeline

For detailed troubleshooting and advanced configuration, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).