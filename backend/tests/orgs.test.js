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

  beforeEach(() => {
    FakeWorkOS.lastOrganizationCreateInput = null;
    FakeWorkOS.organizationCounter = 0;
    FakeWorkOS.nextOrganizationId = null;
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
      password: 'password123'
    });

    const createRes = await agent.post('/api/orgs').send({ name: 'Acme Corp', slug: 'acme' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.organization.role).toBe('org_owner');

    const listRes = await agent.get('/api/orgs');
    expect(listRes.status).toBe(200);
    expect(listRes.body.organizations[0]).toMatchObject({ name: 'Acme Corp', role: 'org_owner' });
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

    const org = await Organization.findOne({ workosOrganizationId: 'org_123' });
    expect(org).toBeTruthy();
    const membership = await OrganizationMembership.findOne({ organization: org._id, user: res.body.user.id });
    expect(membership).toBeTruthy();
    const user = await User.findById(res.body.user.id);
    expect(String(user.defaultOrganization)).toEqual(String(org._id));
  });

  test('enforces vendor suite seat limits when adding members', async () => {
    const ownerAgent = request.agent(app);
    await ownerAgent.post('/api/auth/signup').send({
      name: 'Vendor Owner',
      email: 'vendor-owner@example.com',
      password: 'password123'
    });

    const orgRes = await ownerAgent
      .post('/api/orgs')
      .send({ name: 'Vendor Seats', slug: 'vendor-seats', seatLimits: { vendorSuite: 1, buyerSuite: 0, bothSuites: 0 } });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.organization.id;

    const organization = await Organization.findById(orgId);
    organization.vendorSuiteEnabled = true;
    organization.buyerSuiteEnabled = false;
    await organization.save();

    const ownerMembership = await OrganizationMembership.findOne({ organization: orgId });
    ownerMembership.vendorSuiteEnabled = true;
    ownerMembership.buyerSuiteEnabled = false;
    await ownerMembership.save();

    const memberAgent = request.agent(app);
    await memberAgent.post('/api/auth/signup').send({
      name: 'Second Vendor',
      email: 'second-vendor@example.com',
      password: 'password123'
    });

    const addRes = await ownerAgent.post(`/api/orgs/${orgId}/members`).send({
      email: 'second-vendor@example.com',
      role: 'vendor_user',
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: false
    });

    expect(addRes.status).toBe(400);
    expect(addRes.body).toMatchObject({ error: 'seat_limit_exceeded', details: { suite: 'vendor' } });
  });

  test('enforces buyer suite seat limits when adding members', async () => {
    const ownerAgent = request.agent(app);
    await ownerAgent.post('/api/auth/signup').send({
      name: 'Buyer Owner',
      email: 'buyer-owner@example.com',
      password: 'password123'
    });

    const orgRes = await ownerAgent
      .post('/api/orgs')
      .send({ name: 'Buyer Seats', slug: 'buyer-seats', seatLimits: { vendorSuite: 0, buyerSuite: 1, bothSuites: 0 } });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.organization.id;

    const organization = await Organization.findById(orgId);
    organization.vendorSuiteEnabled = false;
    organization.buyerSuiteEnabled = true;
    await organization.save();

    const ownerMembership = await OrganizationMembership.findOne({ organization: orgId });
    ownerMembership.vendorSuiteEnabled = false;
    ownerMembership.buyerSuiteEnabled = true;
    await ownerMembership.save();

    const memberAgent = request.agent(app);
    await memberAgent.post('/api/auth/signup').send({
      name: 'Second Buyer',
      email: 'second-buyer@example.com',
      password: 'password123'
    });

    const addRes = await ownerAgent.post(`/api/orgs/${orgId}/members`).send({
      email: 'second-buyer@example.com',
      role: 'buyer_user',
      vendorSuiteEnabled: false,
      buyerSuiteEnabled: true
    });

    expect(addRes.status).toBe(400);
    expect(addRes.body).toMatchObject({ error: 'seat_limit_exceeded', details: { suite: 'buyer' } });
  });

  test('enforces shared seats for users enabled for both suites', async () => {
    const ownerAgent = request.agent(app);
    await ownerAgent.post('/api/auth/signup').send({
      name: 'Both Owner',
      email: 'both-owner@example.com',
      password: 'password123'
    });

    const orgRes = await ownerAgent
      .post('/api/orgs')
      .send({ name: 'Both Seats', slug: 'both-seats', seatLimits: { vendorSuite: 0, buyerSuite: 0, bothSuites: 1 } });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.organization.id;

    const organization = await Organization.findById(orgId);
    organization.vendorSuiteEnabled = true;
    organization.buyerSuiteEnabled = true;
    await organization.save();

    const ownerMembership = await OrganizationMembership.findOne({ organization: orgId });
    ownerMembership.vendorSuiteEnabled = true;
    ownerMembership.buyerSuiteEnabled = true;
    await ownerMembership.save();

    const memberAgent = request.agent(app);
    await memberAgent.post('/api/auth/signup').send({
      name: 'Second Both',
      email: 'second-both@example.com',
      password: 'password123'
    });

    const addRes = await ownerAgent.post(`/api/orgs/${orgId}/members`).send({
      email: 'second-both@example.com',
      role: 'vendor_user',
      vendorSuiteEnabled: true,
      buyerSuiteEnabled: true
    });

    expect(addRes.status).toBe(400);
    expect(addRes.body).toMatchObject({ error: 'seat_limit_exceeded', details: { suite: 'both' } });
  });
});
