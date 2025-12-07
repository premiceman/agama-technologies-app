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
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const createRes = await agent.post('/api/orgs').send({ name: 'Acme Corp', slug: 'acme' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.organization.role).toBe('org_owner');

    const listRes = await agent.get('/api/orgs');
    expect(listRes.status).toBe(200);
    expect(listRes.body.organizations[0]).toMatchObject({ name: 'Acme Corp', role: 'org_owner' });
  });

  test('self-service org creation stores WorkOS organization id when configured', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'WorkOS Owner',
      email: 'workos-owner@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const createRes = await agent.post('/api/orgs').send({
      name: 'WorkOS Self Org',
      slug: 'workos-self-org',
      domains: ['self.example.com']
    });

    expect(createRes.status).toBe(201);

    const Organization = require('../models/Organization');
    const organization = await Organization.findOne({ slug: 'workos-self-org' });
    expect(organization.workosOrganizationId).toBe('org_test_1');
    expect(FakeWorkOS.lastOrganizationCreateInput).toMatchObject({
      name: 'WorkOS Self Org',
      domainData: [{ domain: 'self.example.com', state: 'verified' }]
    });
  });

  test('admin org creation syncs WorkOS organization id', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Staff Admin',
      email: 'staff@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const User = require('../models/User');
    const staffUser = await User.findOne({ email: 'staff@example.com' });
    staffUser.isStaff = true;
    await staffUser.save();

    const res = await agent.post('/api/admin/organizations').send({
      name: 'Admin WorkOS Org',
      productAccess: ['valuesphere'],
      domains: ['admin.example.com']
    });

    expect(res.status).toBe(201);

    const Organization = require('../models/Organization');
    const organization = await Organization.findOne({ name: 'Admin WorkOS Org' });
    expect(organization.workosOrganizationId).toBe('org_test_1');
    expect(FakeWorkOS.lastOrganizationCreateInput).toMatchObject({
      name: 'Admin WorkOS Org',
      domainData: [{ domain: 'admin.example.com', state: 'verified' }]
    });
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
      .send({ email: 'second@example.com', role: 'vendor_user' });

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

  test('admin org update cascades product access changes to active members', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Staff User',
      email: 'staff-update@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const User = require('../models/User');
    const Organization = require('../models/Organization');
    const OrganizationMembership = require('../models/OrganizationMembership');

    const staff = await User.findOne({ email: 'staff-update@example.com' });
    staff.isStaff = true;
    await staff.save();

    const createRes = await agent.post('/api/admin/organizations').send({
      name: 'Cascade Org',
      productAccess: ['valuesphere', 'procurepath']
    });
    expect(createRes.status).toBe(201);

    const organization = await Organization.findOne({ name: 'Cascade Org' });

    await request(app).post('/api/auth/signup').send({
      name: 'Member User',
      email: 'member-update@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere', 'procurepath']
    });
    const memberUser = await User.findOne({ email: 'member-update@example.com' });

    await OrganizationMembership.create({
      organization: organization._id,
      user: memberUser._id,
      role: 'vendor_user',
      status: 'active'
    });

    const patchRes = await agent
      .patch(`/api/admin/organizations/${organization._id}`)
      .send({ productAccess: ['valuesphere'] });

    expect(patchRes.status).toBe(200);

    const refreshedMember = await User.findById(memberUser._id);
    expect(refreshedMember.platformAccess).toEqual(['valuesphere']);
  });

  test('admin org update respects member license constraints when syncing access', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Staff Two',
      email: 'staff-constraints@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const User = require('../models/User');
    const Organization = require('../models/Organization');
    const OrganizationMembership = require('../models/OrganizationMembership');

    const staff = await User.findOne({ email: 'staff-constraints@example.com' });
    staff.isStaff = true;
    await staff.save();

    const orgRes = await agent.post('/api/admin/organizations').send({
      name: 'Constraint Org',
      productAccess: ['valuesphere']
    });
    expect(orgRes.status).toBe(201);

    const organization = await Organization.findOne({ name: 'Constraint Org' });

    await request(app).post('/api/auth/signup').send({
      name: 'Personal Member',
      email: 'personal-member@example.com',
      password: 'password123',
      licenseTier: 'personal',
      platformAccess: ['valuesphere']
    });
    const personalUser = await User.findOne({ email: 'personal-member@example.com' });

    await OrganizationMembership.create({
      organization: organization._id,
      user: personalUser._id,
      role: 'vendor_user',
      status: 'active'
    });

    const updateRes = await agent
      .patch(`/api/admin/organizations/${organization._id}`)
      .send({ productAccess: ['revenueforge'] });

    expect(updateRes.status).toBe(200);

    const refreshedPersonal = await User.findById(personalUser._id);
    expect(refreshedPersonal.platformAccess).toEqual([]);
  });

  test('enforces suite boundaries for vendor endpoints', async () => {
    const ownerAgent = request.agent(app);
    await ownerAgent.post('/api/auth/signup').send({
      name: 'Vendor Owner',
      email: 'vendor-owner@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere', 'revenueforge']
    });

    const orgRes = await ownerAgent.post('/api/orgs').send({ name: 'Vendor Org', slug: 'vendor-org' });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.organization.id;

    const buyerAgent = request.agent(app);
    await buyerAgent.post('/api/auth/signup').send({
      name: 'Buyer Member',
      email: 'buyer-member@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere', 'procurepath']
    });

    const addRes = await ownerAgent.post(`/api/orgs/${orgId}/members`).send({
      email: 'buyer-member@example.com',
      role: 'buyer_user',
      buyerSuiteEnabled: true,
      vendorSuiteEnabled: false,
      sharedSuiteEnabled: true
    });
    expect(addRes.status === 200 || addRes.status === 201).toBe(true);

    const User = require('../models/User');
    const buyerUser = await User.findOne({ email: 'buyer-member@example.com' });
    buyerUser.defaultOrganization = orgId;
    await buyerUser.save();

    const vendorAccess = await ownerAgent.get('/api/revenueforge/accounts');
    expect(vendorAccess.status).toBe(200);

    const buyerBlocked = await buyerAgent.get('/api/revenueforge/accounts');
    expect(buyerBlocked.status).toBe(403);
  });

  test('dual-suite users can access buyer endpoints inside the same org', async () => {
    const dualAgent = request.agent(app);
    await dualAgent.post('/api/auth/signup').send({
      name: 'Dual Persona',
      email: 'dual@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere', 'revenueforge', 'procurepath']
    });

    const orgRes = await dualAgent.post('/api/orgs').send({ name: 'Dual Org', slug: 'dual-org' });
    expect(orgRes.status).toBe(201);

    const procurePathRes = await dualAgent.get('/api/procurepath/vendors');
    expect(procurePathRes.status).toBe(200);

    const revenueRes = await dualAgent.get('/api/revenueforge/accounts');
    expect(revenueRes.status).toBe(200);
  });
});
