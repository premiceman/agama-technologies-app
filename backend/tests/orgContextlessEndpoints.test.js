process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongo;

async function waitForConnection() {
  if (mongoose.connection.readyState === 1) return;
  await new Promise((resolve, reject) => {
    mongoose.connection.once('connected', resolve);
    mongoose.connection.once('error', reject);
  });
}

describe('Authenticated endpoints without org context', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    app = require('../index');
    await waitForConnection();
  });

  afterAll(async () => {
    if (mongo) {
      await mongo.stop();
    }
    await mongoose.disconnect();
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  test('GET /api/me/context responds without organization membership', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Context Lite',
      email: 'context-lite@example.com',
      password: 'password123'
    });

    const res = await agent.get('/api/me/context');
    expect(res.status).toBe(200);
    expect(res.body.organizationContext).toBe(null);
    expect(res.body.activeOrg).toBe(null);
    expect(res.body.accessState).toBe('active');
  });

  test('GET /api/me/context requires authentication', async () => {
    const res = await request(app).get('/api/me/context');
    expect(res.status).toBe(401);
  });

  test('GET /api/notifications works without org membership but enforces login', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Notify Me',
      email: 'notify@example.com',
      password: 'password123'
    });

    const authed = await agent.get('/api/notifications');
    expect(authed.status).toBe(200);
    expect(Array.isArray(authed.body.notifications)).toBe(true);

    const anonymous = await request(app).get('/api/notifications');
    expect(anonymous.status).toBe(401);
  });
});
