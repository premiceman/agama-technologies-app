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

function clearIndexCache() {
  try {
    delete require.cache[require.resolve('../index')];
  } catch (err) {
    // ignore
  }
}

async function waitForConnection() {
  if (mongoose.connection.readyState === 1) return;
  await new Promise((resolve, reject) => {
    mongoose.connection.once('connected', resolve);
    mongoose.connection.once('error', reject);
  });
}

describe('Organizations and memberships', () => {
  beforeAll(async () => {
    installWorkOSStub();
    clearIndexCache();
    await mongoose.disconnect();
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

  test('creating an org assigns owner membership', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Owner One',
      email: 'owner@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const createRes = await agent.post('/api/orgs').send({ name: 'Acme Corp', slug: 'acme' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.organization.role).toBe('owner');

    const listRes = await agent.get('/api/orgs');
    expect(listRes.status).toBe(200);
    expect(listRes.body.organizations[0]).toMatchObject({ name: 'Acme Corp', role: 'owner' });
  });

  test('enforces seat limit when activating new members', async () => {
    const ownerAgent = request.agent(app);
    await ownerAgent.post('/api/auth/signup').send({
      name: 'Owner Seat',
      email: 'seat-owner@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const orgRes = await ownerAgent.post('/api/orgs').send({ name: 'Seat Co', slug: 'seat-co', seatLimit: 1 });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.organization.id;

    const memberAgent = request.agent(app);
    await memberAgent.post('/api/auth/signup').send({
      name: 'Second User',
      email: 'second@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const addRes = await ownerAgent
      .post(`/api/orgs/${orgId}/members`)
      .send({ email: 'second@example.com', role: 'member' });

    expect(addRes.status).toBe(403);
    expect(/Seat limit/i.test(addRes.body.error || '')).toBeTruthy();

    const OrganizationMembership = require('../models/OrganizationMembership');
    const User = require('../models/User');
    const seatsUsed = await OrganizationMembership.countActiveSeats(orgId);
    expect(seatsUsed).toBe(1);
    const memberUser = await User.findOne({ email: 'second@example.com' });
    const membership = await OrganizationMembership.findOne({ organization: orgId, user: memberUser._id });
    expect(membership.status).toBe('suspended');
  });

  test('auth me returns organization context', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Context User',
      email: 'context@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    await agent.post('/api/orgs').send({ name: 'Context Org', slug: 'context-org' });

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.organizationContext).toMatchObject({ name: 'Context Org' });
  });

  test('workos callback associates organization and membership', async () => {
    FakeWorkOS.mockAuthResponse = {
      organization_id: 'org_123',
      user: {
        id: 'user_123',
        email: 'sso@example.com',
        firstName: 'SSO',
        lastName: 'User',
        organization: { name: 'WorkOS Org' }
      }
    };

    const res = await request(app)
      .get('/api/auth/workos/callback')
      .set('Cookie', 'workos_auth_state=teststate')
      .set('Accept', 'application/json')
      .query({ code: 'abc', state: 'teststate' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();

    const Organization = require('../models/Organization');
    const OrganizationMembership = require('../models/OrganizationMembership');
    const User = require('../models/User');
    const org = await Organization.findOne({ workosOrganizationId: 'org_123' });
    expect(org).toBeTruthy();
    const membership = await OrganizationMembership.findOne({ organization: org._id, user: res.body.user.id });
    expect(membership).toBeTruthy();
    const user = await User.findById(res.body.user.id);
    expect(String(user.defaultOrganization)).toEqual(String(org._id));
  });
});
