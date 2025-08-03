---
inclusion: always
---

# Web Time Tracker - Product & Architecture Guide

This is an iframe-embeddable time tracking application for GoHighLevel with multi-user support and offline capabilities.

## Core Features & Implementation Rules

### Time Tracking Operations
- Always validate time entries on both client and server
- Use `Date.now()` for precise timestamps, store as UTC in database
- Implement optimistic updates with rollback on failure
- Track state: `idle`, `running`, `paused` with transition validation

### User Authentication & Sessions
- Use JWT access tokens (15min) + refresh tokens (7 days)
- Store tokens in httpOnly cookies, never localStorage
- Implement automatic token refresh before expiration
- Each user session must be isolated (no data leakage)

### Offline-First Architecture
- Queue all mutations in IndexedDB when offline
- Sync queued operations on reconnection with conflict resolution
- Show clear offline/online status indicators
- Never lose user data - always persist locally first

## Iframe Embedding Requirements

### UI Constraints
- Design for minimum 400px height, 300px width
- Use compact layouts with collapsible sections
- Implement responsive breakpoints: 300px, 500px, 800px
- Avoid modals - use inline editing and dropdowns

### Security & Communication
- Set `X-Frame-Options: SAMEORIGIN` or specific domains
- Configure CSP headers for GoHighLevel embedding
- Use postMessage API for parent frame communication
- Validate all cross-origin messages

### Performance Standards
- Client bundle must be <500KB gzipped
- Initial load time <2 seconds on 3G
- Time tracking operations <200ms response time
- Lazy load non-critical components

## Code Architecture Patterns

### State Management
- **Zustand**: UI state, user preferences, offline queue
- **React Query**: Server state, caching, background sync
- **Context**: Theme, user session, iframe communication

### Component Structure
```
components/
├── ui/           # Reusable UI components
├── features/     # Feature-specific components
├── layouts/      # Layout components for iframe
└── providers/    # Context providers
```

### API Design
- RESTful endpoints with consistent error responses
- WebSocket events for real-time updates
- Batch operations for offline sync
- Idempotent operations with request IDs

## Development Standards

### Error Handling
- Wrap all async operations in try-catch
- Use React Error Boundaries for component errors
- Log errors with context (user ID, action, timestamp)
- Show user-friendly error messages, never expose internals

### Testing Requirements
- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Test offline/online transitions and iframe scenarios

### Accessibility
- WCAG 2.1 AA compliance required
- Keyboard navigation for all interactive elements
- Screen reader support with proper ARIA labels
- High contrast mode compatibility

## Technical Constraints

### Browser Support
- Modern browsers with ES2020+ support
- No IE support required
- Progressive enhancement for older browsers

### Data Storage
- PostgreSQL for persistent data with proper indexing
- Redis for session storage and real-time features
- IndexedDB for offline data with 50MB limit
- Implement data retention policies (90 days default)