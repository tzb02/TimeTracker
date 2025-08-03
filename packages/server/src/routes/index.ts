import { Router } from 'express';
import authRoutes from './auth';
import timerRoutes from './timers';
import projectRoutes from './projects';
import timeEntryRoutes from './timeEntries';
import reportRoutes from './reports';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

console.log('🔄 Initializing API router...');

// Apply general rate limiting to all API routes
try {
  router.use(apiLimiter);
  console.log('✅ Rate limiter applied');
} catch (error) {
  console.error('❌ Failed to apply rate limiter:', error);
}

// Health check endpoint (no rate limiting)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});


// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Web Time Tracker API',
      version: process.env.npm_package_version || '1.0.0',
      description: 'REST API for iframe-embeddable time tracking application',
      endpoints: {
        auth: '/api/auth',
        timers: '/api/timers',
        entries: '/api/entries',
        projects: '/api/projects',
        reports: '/api/reports'
      }
    }
  });
});

// Mount route modules
console.log('🔄 Mounting route modules...');
try {
  router.use('/auth', authRoutes);
  console.log('✅ Auth routes mounted');
  router.use('/timers', timerRoutes);
  console.log('✅ Timer routes mounted');
  router.use('/projects', projectRoutes);
  console.log('✅ Project routes mounted');
  router.use('/entries', timeEntryRoutes);
  console.log('✅ Time entry routes mounted');
  router.use('/reports', reportRoutes);
  console.log('✅ Report routes mounted');
  console.log('✅ All route modules mounted successfully');
} catch (error) {
  console.error('❌ Failed to mount route modules:', error);
  throw error;
}

export default router;