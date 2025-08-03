import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const handlers = [
  // Auth endpoints
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        token: 'mock-jwt-token',
        user: {
          id: 'user1',
          email: 'test@example.com',
          name: 'Test User',
        },
      })
    );
  }),

  rest.post('/api/auth/register', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        user: {
          id: 'user1',
          email: 'test@example.com',
          name: 'Test User',
        },
      })
    );
  }),

  rest.post('/api/auth/logout', (req, res, ctx) => {
    return res(ctx.json({ success: true }));
  }),

  // Timer endpoints
  rest.get('/api/timers/active', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'timer1',
        projectId: 'project1',
        startTime: new Date().toISOString(),
        isRunning: false,
        elapsedTime: 0,
      })
    );
  }),

  rest.post('/api/timers/start', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'timer1',
        projectId: 'project1',
        startTime: new Date().toISOString(),
        isRunning: true,
        elapsedTime: 0,
      })
    );
  }),

  rest.post('/api/timers/:id/stop', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'timer1',
        isRunning: false,
        timeEntry: {
          id: 'entry1',
          projectId: 'project1',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 3600,
        },
      })
    );
  }),

  // Project endpoints
  rest.get('/api/projects', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'project1',
          name: 'Test Project',
          color: '#3B82F6',
          userId: 'user1',
        },
      ])
    );
  }),

  rest.post('/api/projects', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'project1',
        name: 'Test Project',
        color: '#3B82F6',
        userId: 'user1',
      })
    );
  }),

  // Time entry endpoints
  rest.get('/api/time-entries', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'entry1',
          projectId: 'project1',
          description: 'Test task',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 3600,
          userId: 'user1',
        },
      ])
    );
  }),

  // Report endpoints
  rest.get('/api/reports', (req, res, ctx) => {
    return res(
      ctx.json({
        totalTime: 7200,
        projectBreakdown: [
          {
            projectId: 'project1',
            projectName: 'Test Project',
            totalTime: 7200,
            color: '#3B82F6',
          },
        ],
        dailyBreakdown: [
          {
            date: new Date().toISOString().split('T')[0],
            totalTime: 7200,
          },
        ],
      })
    );
  }),

  // Health check
  rest.get('/health', (req, res, ctx) => {
    return res(
      ctx.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      })
    );
  }),
];

export const server = setupServer(...handlers);