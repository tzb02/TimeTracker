import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initializeDatabase, createDatabaseConfig } from './database';
import { initializeSocketService } from './services/socketService';

// Import middleware
import { securityHeaders, corsOptions, iframeHeaders, requestLogger } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes will be imported after database initialization

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3003;

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Request logging (development only by default)
app.use(requestLogger);

// Security middleware
app.use(securityHeaders);
app.use(iframeHeaders);

// CORS configuration for iframe embedding
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health check endpoint (before API routes, no rate limiting)
app.get('/health', async (req, res) => {
  try {
    const db = require('./database').getDatabase();
    const dbHealthy = await db.healthCheck();
    
    res.status(200).json({
      success: true,
      data: {
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: {
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'not_initialized',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  }
});

// API routes will be mounted after database initialization

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    let db;
    try {
      const dbConfig = createDatabaseConfig();
      db = initializeDatabase(dbConfig);
      await db.connect();
    } catch (dbError) {
      console.warn('PostgreSQL not available, using mock database for development');
      const { initializeMockDatabase, resetDatabase } = await import('./database/connection');
      resetDatabase(); // Reset the failed connection
      db = initializeMockDatabase();
      await db.connect();
    }
    
    // Initialize session manager (Redis)
    let sessionManager;
    try {
      const { getSessionManager } = await import('./services/sessionManager');
      sessionManager = getSessionManager();
      await sessionManager.connect();
    } catch (redisError) {
      console.warn('Redis not available, using mock session manager for development');
      const { MockSessionManager } = await import('./services/mockSessionManager');
      sessionManager = new MockSessionManager();
      await sessionManager.connect();
    }
    
    // Import and mount API routes after database initialization
    console.log('🔄 Loading API routes...');
    try {
      const apiRoutes = (await import('./routes')).default;
      console.log('🔍 API routes object:', typeof apiRoutes, apiRoutes);
      
      // Mount API routes with /api prefix
      app.use('/api', apiRoutes);
      console.log('✅ API routes loaded successfully');
      
      // Test if routes are actually mounted
      console.log('🔍 Testing route mounting...');
      const routes: string[] = [];
      (app as any)._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push(middleware.route.path);
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach((handler: any) => {
            if (handler.route) {
              routes.push(handler.route.path);
            }
          });
        }
      });
      console.log('🔍 Mounted routes:', routes);
    } catch (error) {
      console.error('❌ Failed to load API routes:', error);
      throw error;
    }
    
    // Error handling middleware (must be last, after all routes)
    app.use(notFoundHandler);
    app.use(errorHandler);
    console.log('✅ Error handlers mounted');
    
    // Initialize Socket.io
    const socketService = initializeSocketService(server);
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Database: Connected`);
      console.log(`📦 Redis: Connected`);
      console.log(`🔒 Security: Iframe embedding enabled`);
      console.log(`⚡ Rate limiting: Enabled`);
      console.log(`🔌 Socket.io: Enabled`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  try {
    const { getSocketService } = await import('./services/socketService');
    const socketService = getSocketService();
    await socketService.shutdown();
    
    const db = require('./database').getDatabase();
    await db.disconnect();
    
    const { getSessionManager } = await import('./services/sessionManager');
    const sessionManager = getSessionManager();
    await sessionManager.disconnect();
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  try {
    const { getSocketService } = await import('./services/socketService');
    const socketService = getSocketService();
    await socketService.shutdown();
    
    const db = require('./database').getDatabase();
    await db.disconnect();
    
    const { getSessionManager } = await import('./services/sessionManager');
    const sessionManager = getSessionManager();
    await sessionManager.disconnect();
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

// Start the server only if not in Vercel environment
if (!process.env.VERCEL) {
  startServer();
}

export default app;