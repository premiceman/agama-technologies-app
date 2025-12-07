process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.5';

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

async function bootstrapApp() {
  if (app) return app;
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.disconnect();
  // Clear cached app between tests to avoid model redefinition errors
  Object.keys(require.cache).forEach(key => {
    if (key.includes('/backend/index.js')) delete require.cache[key];
  });
  app = require('../index');
  await waitForConnection();
  return app;
}

describe('Integration management', () => {
  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  afterAll(async () => {
    if (mongo) {
      await mongo.stop();
    }
    await mongoose.disconnect();
  });

  test('staff can create and sync an integration connection', async () => {
    const server = await bootstrapApp();
    const agent = request.agent(server);
    const AdminConfig = require('../models/AdminConfig');
    const User = require('../models/User');

    await AdminConfig.create({ _id: 'agama-admin-console', secretKey: 'letmein' });

    await agent.post('/api/auth/signup').send({
      name: 'Staff User',
      email: 'staff@agamatechnologies.com',
      password: 'password123',
    });

    const staffUser = await User.findOne({ email: 'staff@agamatechnologies.com' });
    staffUser.isStaff = true;
    await staffUser.save();

    const unlockRes = await agent.post('/api/agama-admin/unlock').send({ secret: 'letmein' });
    expect(unlockRes.status).toBe(200);

    const orgRes = await agent.post('/api/admin/organizations').send({
      name: 'Staff Org',
      productAccess: ['valuesphere'],
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: true
    });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.organization.id;

    const createRes = await agent.post('/api/agama-admin/integrations').send({
      orgId,
      type: 'crm',
      provider: 'salesforce'
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.integration).toMatchObject({
      orgId,
      type: 'crm',
      provider: 'salesforce'
    });

    const integrationId = createRes.body.integration.id;
    const syncRes = await agent.post(`/api/agama-admin/integrations/${integrationId}/sync`).send();
    expect(syncRes.status).toBe(200);
    expect(syncRes.body.integration.lastSyncStatus).toBe('ok');
    expect(syncRes.body.integration.lastSyncAt).toBeTruthy();
  });

  test('org admin can manage integrations within their org', async () => {
    const server = await bootstrapApp();
    const agent = request.agent(server);

    await agent.post('/api/auth/signup').send({
      name: 'Owner User',
      email: 'owner@example.com',
      password: 'password123',
    });

    const orgRes = await agent.post('/api/orgs').send({ name: 'Owner Org', slug: 'owner-org' });
    expect(orgRes.status).toBe(201);

    const createRes = await agent.post('/api/org/admin/integrations').send({
      type: 'email',
      provider: 'google'
    });

    expect(createRes.status).toBe(201);
    const integrationId = createRes.body.integration.id;
    expect(createRes.body.integration.orgId).toBeDefined();

    const syncRes = await agent.post(`/api/org/admin/integrations/${integrationId}/sync`).send();
    expect(syncRes.status).toBe(200);
    expect(syncRes.body.integration.lastSyncStatus).toBe('ok');
    expect(syncRes.body.integration.lastSyncSummary).toMatch(/simulated/i);
  });
});
