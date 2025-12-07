process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub, FakeWorkOS } = require('./helpers/workosStub');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');
const User = require('../models/User');

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

  test('returns context for user with multiple organizations', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Context Multi',
      email: 'multiorg@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere', 'procurepath']
    });

    const orgOne = await agent.post('/api/orgs').send({ name: 'Context One', slug: 'context-one' });
    const orgTwo = await agent.post('/api/orgs').send({ name: 'Context Two', slug: 'context-two' });

    expect(orgOne.status).toBe(201);
    expect(orgTwo.status).toBe(201);

    const contextRes = await agent.get('/api/me/context');
    expect(contextRes.status).toBe(200);
    expect(contextRes.body).toMatchObject({
      ok: true,
      orgRole: 'org_owner',
      persona: 'both',
      themeHint: 'shared',
      suites: { vendor: true, buyer: true },
      activeOrg: {
        id: orgOne.body.organization.id,
        name: 'Context One',
        slug: 'context-one',
        orgType: 'both'
      }
    });
    expect(contextRes.body.user.persona).toBe('both');

    const secondOrgContext = await agent.get(`/api/me/context?orgId=${orgTwo.body.organization.id}`);
    expect(secondOrgContext.status).toBe(200);
    expect(secondOrgContext.body.activeOrg.id).toBe(orgTwo.body.organization.id);
  });

  test('returns suites derived from membership flags', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Suite Mix',
      email: 'mix@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const orgRes = await agent.post('/api/orgs').send({ name: 'Mix Org', slug: 'mix-org' });
    const orgId = orgRes.body.organization.id;

    const membership = await OrganizationMembership.findOne({ organization: orgId });
    membership.buyerSuiteEnabled = false;
    membership.vendorSuiteEnabled = true;
    await membership.save();

    const contextRes = await agent.get(`/api/me/context?orgId=${orgId}`);
    expect(contextRes.status).toBe(200);
    expect(contextRes.body).toMatchObject({
      ok: true,
      orgRole: 'org_owner',
      persona: 'both',
      themeHint: 'shared',
      suites: { vendor: true, buyer: false },
      activeOrg: {
        id: orgId,
        name: 'Mix Org',
        slug: 'mix-org',
        orgType: 'both'
      }
    });
  });

  test('returns buyer theme when persona is buyer', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Buyer Persona',
      email: 'buyer@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['procurepath']
    });

    await agent.patch('/api/auth/persona').send({ persona: 'buyer' });
    const orgRes = await agent.post('/api/orgs').send({ name: 'Buyer Org', slug: 'buyer-org' });
    const orgId = orgRes.body.organization.id;

    const contextRes = await agent.get(`/api/me/context?orgId=${orgId}`);
    expect(contextRes.status).toBe(200);
    expect(contextRes.body).toMatchObject({
      ok: true,
      orgRole: 'org_owner',
      persona: 'buyer',
      themeHint: 'buyer',
      suites: { vendor: true, buyer: true },
      activeOrg: {
        id: orgId,
        name: 'Buyer Org',
        slug: 'buyer-org',
        orgType: 'both'
      },
      user: { email: 'buyer@example.com', persona: 'buyer' }
    });
  });

  test('creates an organization and membership for WorkOS logins without orgs', async () => {
    const agent = request.agent(app);
    FakeWorkOS.mockAuthResponse = {
      user: { id: 'user_abc', email: 'newuser@example.com', firstName: 'New', lastName: 'User' },
      session: { id: 'sess_abc' }
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

    const user = await User.findOne({ email: 'newuser@example.com' });
    const memberships = await OrganizationMembership.find({ user: user._id });
    expect(memberships).toHaveLength(1);
    const membership = memberships[0];
    const organization = await Organization.findById(membership.organization);
    expect(organization).toBeTruthy();
    expect(membership.role).toBe('org_owner');
    expect(membership.vendorSuiteEnabled).toBe(true);
    expect(membership.buyerSuiteEnabled).toBe(false);
  });

  test('reuses existing organization membership on WorkOS login', async () => {
    const agent = request.agent(app);
    const existingUser = await User.create({
      name: 'Existing User',
      email: 'existing@example.com',
      passwordHash: null,
      authSource: 'local'
    });
    const organization = await Organization.create({
      name: 'Existing Org',
      slug: 'existing-org',
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: true
    });
    await OrganizationMembership.create({
      organization: organization._id,
      user: existingUser._id,
      role: 'org_owner',
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: true
    });

    FakeWorkOS.mockAuthResponse = {
      user: { id: 'user_existing', email: 'existing@example.com', firstName: 'Existing', lastName: 'User' },
      session: { id: 'sess_existing' }
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

    const memberships = await OrganizationMembership.find({ user: existingUser._id });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].organization.toString()).toBe(organization._id.toString());
  });

  test('normalizes legacy persona to both on WorkOS login', async () => {
    const agent = request.agent(app);
    const user = await User.create({
      name: 'Legacy Persona',
      email: 'legacy@example.com',
      passwordHash: null,
      persona: 'both',
      authSource: 'workos'
    });

    FakeWorkOS.mockAuthResponse = {
      user: { id: 'user_legacy', email: 'legacy@example.com', firstName: 'Legacy', lastName: 'User' },
      session: { id: 'sess_legacy' }
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

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.persona).toBe('both');
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
