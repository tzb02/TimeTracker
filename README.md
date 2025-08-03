# Web Time Tracker

A modern, web-based time tracking application built for iframe embedding in GoHighLevel and other platforms. Features real-time tracking, comprehensive reporting, and seamless integration capabilities.

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TimeTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3003

## 📦 Project Structure

```
TimeTracker/
├── packages/
│   ├── client/          # React frontend (Vite + TypeScript)
│   └── server/          # Express.js backend (Node.js + TypeScript)
├── docs/                # Documentation
├── scripts/             # Deployment scripts
├── monitoring/          # Prometheus configuration
└── nginx/              # Nginx configuration
```

## 🌟 Features

- **Real-time Time Tracking**: Start, stop, and pause timers with precision
- **Project Management**: Organize work by projects and categories
- **Comprehensive Reporting**: Detailed analytics and export capabilities
- **User Authentication**: Secure login and session management
- **Iframe Integration**: Seamless embedding in external platforms
- **Offline Support**: Service worker for offline functionality
- **Responsive Design**: Works on desktop and mobile devices
- **Data Export**: CSV and PDF export capabilities

## 🛠 Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **React Query** for state management and caching
- **Zustand** for local state management
- **React Hook Form** with Zod validation

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **PostgreSQL** for data persistence
- **Redis** for session management and caching
- **JWT** for authentication
- **Socket.io** for real-time features

### Infrastructure
- **Docker** for containerization
- **Nginx** for reverse proxy
- **Prometheus** for monitoring
- **Grafana** for dashboards

## 🚀 Deployment Options

### Option 1: Vercel (Recommended for Quick Deployment)

**Quick Setup:**
1. Follow the [Quick Vercel Setup Guide](./docs/QUICK_VERCEL_SETUP.md)
2. Use the [Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md)

**Detailed Guide:**
- [Complete Vercel Deployment Guide](./docs/VERCEL_DEPLOYMENT.md)
- [Production Environment Setup](./docs/PRODUCTION_ENVIRONMENT.md)

**External Services Required:**
- Database: Neon, Supabase, or Railway PostgreSQL
- Cache: Upstash or Railway Redis

### Option 2: Docker (Full Control)

**Production Deployment:**
```bash
# Build and deploy
npm run build
docker-compose -f docker-compose.prod.yml up -d
```

**Development Environment:**
```bash
# Start with Docker
npm run docker:dev
```

See [Docker Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

## 📋 Environment Variables

### Development
```bash
# Database
DATABASE_URL=postgresql://localhost:5432/timetracker
REDIS_URL=redis://localhost:6379

# JWT Secrets
JWT_SECRET=your_development_secret
JWT_REFRESH_SECRET=your_development_refresh_secret
SESSION_SECRET=your_development_session_secret

# CORS
CORS_ORIGIN=http://localhost:3001
```

### Production
See [Production Environment Guide](./docs/PRODUCTION_ENVIRONMENT.md) for complete configuration.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📖 Documentation

- [User Guide](./docs/USER_GUIDE.md) - How to use the application
- [API Documentation](./docs/API.md) - Backend API reference
- [Deployment Guide](./docs/DEPLOYMENT.md) - Docker deployment
- [Vercel Deployment](./docs/VERCEL_DEPLOYMENT.md) - Vercel deployment
- [Quick Setup](./docs/QUICK_VERCEL_SETUP.md) - Fast Vercel setup
- [Production Environment](./docs/PRODUCTION_ENVIRONMENT.md) - Production configuration
- [Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md) - Deployment verification

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm 9+
- PostgreSQL 15+
- Redis 7+

### Local Development Setup

1. **Database Setup**
   ```bash
   # Using Docker
   docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
   
   # Create database
   createdb timetracker
   ```

2. **Redis Setup**
   ```bash
   # Using Docker
   docker run --name redis -p 6379:6379 -d redis:7
   ```

3. **Environment Configuration**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit with your configuration
   nano .env
   ```

4. **Database Migration**
   ```bash
   cd packages/server
   npm run migrate
   ```

5. **Start Development**
   ```bash
   npm run dev
   ```

### Available Scripts

```bash
# Development
npm run dev              # Start both client and server
npm run dev:client       # Start only client
npm run dev:server       # Start only server

# Building
npm run build            # Build both packages
npm run build:client     # Build only client
npm run build:server     # Build only server

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode

# Linting
npm run lint             # Lint all packages
npm run lint:fix         # Fix linting issues

# Docker
npm run docker:dev       # Start development with Docker
npm run docker:prod      # Start production with Docker
```

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **CORS Protection** with configurable origins
- **Rate Limiting** to prevent abuse
- **Input Validation** with Zod schemas
- **SQL Injection Protection** with parameterized queries
- **XSS Protection** with DOMPurify
- **HTTPS Enforcement** in production
- **Secure Headers** with Helmet.js

## 📊 Monitoring

### Health Checks
- Application: `/health`
- Database: Included in health endpoint
- Redis: Included in health endpoint

### Metrics (Docker Deployment)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000

### Key Metrics
- Response times
- Error rates
- Database performance
- Memory usage
- Active sessions
- Timer accuracy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Write tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Getting Help
1. Check the [documentation](./docs/)
2. Review [common issues](./docs/DEPLOYMENT_CHECKLIST.md#troubleshooting-common-issues)
3. Search existing GitHub issues
4. Create a new issue with detailed information

### Deployment Support
- [Vercel Deployment Issues](./docs/VERCEL_DEPLOYMENT.md#troubleshooting)
- [Docker Deployment Issues](./docs/DEPLOYMENT.md#troubleshooting)
- [Environment Configuration](./docs/PRODUCTION_ENVIRONMENT.md#troubleshooting)

## 🗺 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced reporting features
- [ ] Team collaboration tools
- [ ] Integration with more platforms
- [ ] Advanced analytics dashboard
- [ ] Automated time tracking suggestions
- [ ] Invoice generation
- [ ] Multi-language support

---

**Ready to deploy?** Start with the [Quick Vercel Setup Guide](./docs/QUICK_VERCEL_SETUP.md) for the fastest deployment experience.#   T i m e T r a c k e r  
 