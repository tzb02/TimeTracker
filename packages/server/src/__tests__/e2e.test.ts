import request from 'supertest';
import { app } from '../index';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';

describe('End-to-End Tests', () => {
  let authToken: string;
  let userId: string;
  let projectId: string;
  let timerId: string;

  beforeAll(async () => {
    // Clean up database
    await pool.query('DELETE FROM time_entries');
    await pool.query('DELETE FROM timers');
    await pool.query('DELETE FROM projects');
    await pool.query('DELETE FROM users');
    
    // Clear Redis
    await redisClient.flushall();
  });

  afterAll(async () => {
    await pool.end();
    await redisClient.quit();
  });

  describe('Complete User Workflow', () => {
    it('should complete full user workflow', async () => {
      // 1. Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'Test User',
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user).toBeDefined();
      userId = registerResponse.body.user.id;

      // 2. Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
      authToken = loginResponse.body.token;

      // 3. Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          color: '#3B82F6',
          description: 'A test project',
        });

      expect(projectResponse.status).toBe(201);
      expect(projectResponse.body.name).toBe('Test Project');
      projectId = projectResponse.body.id;

      // 4. Start timer
      const startTimerResponse = await request(app)
        .post('/api/timers/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Working on test task',
        });

      expect(startTimerResponse.status).toBe(200);
      expect(startTimerResponse.body.isRunning).toBe(true);
      timerId = startTimerResponse.body.id;

      // 5. Get active timer
      const activeTimerResponse = await request(app)
        .get('/api/timers/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(activeTimerResponse.status).toBe(200);
      expect(activeTimerResponse.body.id).toBe(timerId);
      expect(activeTimerResponse.body.isRunning).toBe(true);

      // 6. Pause timer
      const pauseTimerResponse = await request(app)
        .post(`/api/timers/${timerId}/pause`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(pauseTimerResponse.status).toBe(200);
      expect(pauseTimerResponse.body.isRunning).toBe(false);

      // 7. Resume timer
      const resumeTimerResponse = await request(app)
        .post(`/api/timers/${timerId}/resume`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resumeTimerResponse.status).toBe(200);
      expect(resumeTimerResponse.body.isRunning).toBe(true);

      // 8. Stop timer
      const stopTimerResponse = await request(app)
        .post(`/api/timers/${timerId}/stop`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(stopTimerResponse.status).toBe(200);
      expect(stopTimerResponse.body.timeEntry).toBeDefined();

      const timeEntryId = stopTimerResponse.body.timeEntry.id;

      // 9. Get time entries
      const timeEntriesResponse = await request(app)
        .get('/api/time-entries')
        .set('Authorization', `Bearer ${authToken}`);

      expect(timeEntriesResponse.status).toBe(200);
      expect(timeEntriesResponse.body.length).toBe(1);
      expect(timeEntriesResponse.body[0].id).toBe(timeEntryId);

      // 10. Update time entry
      const updateTimeEntryResponse = await request(app)
        .put(`/api/time-entries/${timeEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated task description',
        });

      expect(updateTimeEntryResponse.status).toBe(200);
      expect(updateTimeEntryResponse.body.description).toBe('Updated task description');

      // 11. Generate report
      const reportResponse = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        });

      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body.totalTime).toBeGreaterThan(0);
      expect(reportResponse.body.projectBreakdown).toHaveLength(1);

      // 12. Export report
      const exportResponse = await request(app)
        .get('/api/reports/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          format: 'csv',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        });

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toContain('text/csv');

      // 13. Delete time entry
      const deleteTimeEntryResponse = await request(app)
        .delete(`/api/time-entries/${timeEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteTimeEntryResponse.status).toBe(204);

      // 14. Delete project
      const deleteProjectResponse = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteProjectResponse.status).toBe(204);

      // 15. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(logoutResponse.status).toBe(200);
    });

    it('should handle multi-user isolation', async () => {
      // Create two users
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user1@example.com',
          password: 'TestPassword123!',
          name: 'User 1',
        });

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          password: 'TestPassword123!',
          name: 'User 2',
        });

      // Login both users
      const login1Response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user1@example.com',
          password: 'TestPassword123!',
        });

      const login2Response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user2@example.com',
          password: 'TestPassword123!',
        });

      const token1 = login1Response.body.token;
      const token2 = login2Response.body.token;

      // User 1 creates a project
      const project1Response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: 'User 1 Project',
          color: '#3B82F6',
        });

      // User 2 creates a project
      const project2Response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          name: 'User 2 Project',
          color: '#EF4444',
        });

      // User 1 should only see their project
      const user1ProjectsResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token1}`);

      expect(user1ProjectsResponse.body).toHaveLength(1);
      expect(user1ProjectsResponse.body[0].name).toBe('User 1 Project');

      // User 2 should only see their project
      const user2ProjectsResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token2}`);

      expect(user2ProjectsResponse.body).toHaveLength(1);
      expect(user2ProjectsResponse.body[0].name).toBe('User 2 Project');

      // User 1 should not be able to access User 2's project
      const unauthorizedResponse = await request(app)
        .get(`/api/projects/${project2Response.body.id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(unauthorizedResponse.status).toBe(404);
    });
  });
});