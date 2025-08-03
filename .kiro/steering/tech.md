# Technology Stack

## Build System & Workspace
- **npm workspaces** for monorepo management
- **TypeScript 5.1+** with strict mode enabled
- **Node.js 18+** and **npm 9+** required

## Frontend (Client Package)
- **React 18** with TypeScript
- **Vite** for build tooling and development server
- **Tailwind CSS** for styling and responsive design
- **React Query (@tanstack/react-query)** for API state management
- **Zustand** for local state management
- **React Router DOM** for client-side routing
- **React Hook Form** with Zod validation
- **Vitest** for testing with Testing Library

## Backend (Server Package)
- **Node.js** with **Express.js** framework
- **TypeScript** with strict configuration
- **PostgreSQL 15+** for data persistence
- **Redis 7+** for caching and sessions
- **JWT** for authentication with refresh tokens
- **Socket.io** for real-time WebSocket connections
- **Jest** for testing with Supertest

## Infrastructure & DevOps
- **Docker** and **Docker Compose** for containerization
- **Nginx** for production reverse proxy
- **ESLint** and **Prettier** for code quality
- **Winston** for logging

## Common Commands

### Development
```bash
# Start full development environment with Docker
npm run docker:dev

# Start development servers locally
npm run dev

# Individual package development
npm run dev:server
npm run dev:client
```

### Building & Testing
```bash
# Build all packages
npm run build

# Run all tests
npm run test

# Lint all packages
npm run lint

# Format code
npm run format
```

### Production
```bash
# Start production environment
npm run docker:prod
```

### Package-specific Commands
```bash
# Client package
npm run dev --workspace=client
npm run build --workspace=client
npm run test --workspace=client

# Server package
npm run dev --workspace=server
npm run build --workspace=server
npm run test --workspace=server
```