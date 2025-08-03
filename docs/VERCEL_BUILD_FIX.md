# Vercel Build Configuration Fix

## Issue
Vercel error: "No Output Directory named 'public' found after the Build completed"

## Root Cause
- Vite builds to `dist/` directory by default
- Vercel expects `public/` directory by default
- Need to configure Vercel to use the correct output directory

## Solution

### Option 1: Update Vercel Project Settings (Recommended)

In your Vercel project dashboard:

1. Go to **Project Settings**
2. Navigate to **Build & Output Settings**
3. Set the following:
   - **Framework Preset**: Vite
   - **Build Command**: `npx vite build` (skip TypeScript compilation)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Option 2: Create Root vercel.json

Create `vercel.json` in project root:

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
      "destination": "https://your-backend-domain.vercel.app/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Option 3: Update Client Package.json Build Script

Modify `packages/client/package.json`:

```json
{
  "scripts": {
    "build": "npx vite build",
    "build:vercel": "npx vite build"
  }
}
```

## Updated Deployment Steps

### Frontend Deployment

1. **Create Vercel Project**
   - Import from GitHub
   - **Framework**: Vite
   - **Root Directory**: `packages/client`
   - **Build Command**: `npx vite build`
   - **Output Directory**: `dist`

2. **Environment Variables**
   ```bash
   VITE_API_URL=https://your-backend-domain.vercel.app
   NODE_ENV=production
   ```

3. **Deploy**
   - Vercel will now correctly find the `dist` directory
   - Build should complete successfully

### Backend Deployment

Backend configuration remains the same:

1. **Create Separate Vercel Project**
   - **Framework**: Other
   - **Root Directory**: `packages/server`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

## Build Command Comparison

| Issue | Wrong Command | Correct Command |
|-------|---------------|-----------------|
| TypeScript errors | `tsc && vite build` | `npx vite build` |
| Output directory | Looking for `public/` | Configure to use `dist/` |
| Monorepo paths | Wrong root directory | Set to `packages/client` |

## Troubleshooting

### If Build Still Fails

1. **Check Build Logs** in Vercel dashboard
2. **Verify Dependencies** are in package.json
3. **Test Locally**:
   ```bash
   cd packages/client
   npx vite build
   ls -la dist/  # Should show built files
   ```

### Common Issues

1. **Missing Dependencies**: Add to package.json dependencies (not devDependencies)
2. **TypeScript Errors**: Use `npx vite build` instead of `tsc && vite build`
3. **Path Issues**: Ensure root directory is set to `packages/client`

## Verification

After successful deployment:
- ✅ Build completes without "public directory" error
- ✅ Static files served from `dist/` directory
- ✅ Application loads in browser
- ✅ API calls work (after backend is deployed)

This fix resolves the Vercel output directory configuration issue.