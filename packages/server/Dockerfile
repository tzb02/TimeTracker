FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/server ./packages/server

WORKDIR /app/packages/server

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Install only production dependencies
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/packages/server/dist ./packages/server/dist

WORKDIR /app/packages/server

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

CMD ["npm", "start"]