process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub, FakeWorkOS } = require('./helpers/workosStub');

let app;
let mongo;

async function waitForConnection() {
  if (mongoose.connection.readyState === 1) return;
  await new Promise((resolve, reject) => {
    mongoose.connection.once('connected', resolve);
    mongoose.connection.once('error', reject);
  });
}

describe('Authentication & licensing', () => {
  beforeAll(async () => {
    installWorkOSStub();
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

  test('rejects personal licenses selecting business-only platforms', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Alex Personal',
        email: 'alex@example.com',
        password: 'password123',
        licenseTier: 'personal',
        platformAccess: ['valuesphere', 'procurepath']
      });

    expect(res.status).toBe(400);
    expect(Boolean(res.body.error && /personal licenses/i.test(res.body.error))).toBeTruthy();
  });

  test('creates a personal ValueSphere license', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Jamie Navigator',
        email: 'jamie@example.com',
        password: 'password123',
        licenseTier: 'personal',
        platformAccess: ['valuesphere']
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      licenseTier: 'personal',
      platformAccess: ['valuesphere']
    });
  });

  test('creates a business license with multiple platforms', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Taylor Operations',
        email: 'taylor@example.com',
        password: 'password123',
        licenseTier: 'business',
        platformAccess: ['valuesphere', 'procurepath', 'revenueforge']
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      licenseTier: 'business',
      platformAccess: ['valuesphere', 'procurepath', 'revenueforge']
    });
  });

  test('prevents clearing business platform access', async () => {
    const agent = request.agent(app);

    const signupRes = await agent.post('/api/auth/signup').send({
      name: 'Morgan Org',
      email: 'morgan@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere', 'procurepath']
    });
    expect(signupRes.status).toBe(200);

    const updateRes = await agent.put('/api/auth/me').send({
      platformAccess: []
    });

    expect(updateRes.status).toBe(400);
    expect(Boolean(updateRes.body.error && /select at least one platform/i.test(updateRes.body.error))).toBeTruthy();
  });

  test('logs out via WorkOS when a hosted session is present', async () => {
    const agent = request.agent(app);
    FakeWorkOS.mockAuthResponse = {
      user: { id: 'user_123', email: 'workos@example.com', firstName: 'Work', lastName: 'OS' },
      session: { id: 'sess_123' }
    };

    const loginStart = await agent.get('/api/auth/workos/login').set('Accept', 'application/json');
    const stateCookie = (loginStart.headers['set-cookie'] || []).find(cookie => cookie.startsWith('workos_auth_state='));
    const stateValue = stateCookie?.match(/workos_auth_state=([^;]+)/)?.[1];
    expect(stateValue).toBeTruthy();

    const callbackRes = await agent
      .get('/api/auth/workos/callback')
      .query({ code: 'abc123', state: stateValue })
      .set('Accept', 'application/json');

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.token).toBeTruthy();

    const logoutRes = await agent.post('/api/auth/logout').set('Accept', 'application/json');
    expect(logoutRes.status).toBe(200);
    expect(/https:\/\/example\.com\/logout\/sess_123/.test(logoutRes.body.redirect)).toBeTruthy();
  });
});
