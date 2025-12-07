process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');
const RevenueAccount = require('../models/RevenueAccount');
const ProcurementVendor = require('../models/ProcurementVendor');
const EngagementRoom = require('../models/EngagementRoom');
const BuyerValueAssessment = require('../models/BuyerValueAssessment');

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

async function setupSuite() {
  clearIndexCache();
  await mongoose.disconnect();
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  app = require('../index');
  await waitForConnection();
}

async function createOrgForUser(agent, { name, slug }) {
  const res = await agent.post('/api/orgs').send({ name, slug });
  if (res.status !== 201) {
    throw new Error(`Org creation failed: ${res.status}`);
  }
  const organization = await Organization.findOne({ slug });
  const user = await mongoose.model('User').findOne({ email: /@/ });
  const membership = await OrganizationMembership.findOne({ organization: organization._id, user: user._id });
  return { organization, membership, user };
}

async function seedSharedOrg() {
  return Organization.create({
    name: 'Shared Org',
    slug: `shared-${Date.now()}`,
    seatLimit: 10,
    seatLimits: { vendorSuite: 10, buyerSuite: 10, sharedSuite: 10 },
    tier: 'business',
    platformAccess: ['valuesphere'],
    productAccess: ['valuesphere'],
    vendorSuiteEnabled: true,
    buyerSuiteEnabled: true,
    sharedSuiteEnabled: true
  });
}

describe('Dashboard overview aggregation', () => {
  beforeAll(async () => {
    await setupSuite();
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

  test('vendor-only user gets vendor widgets and no buyer leakage', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Vendor User',
      email: 'vendor@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const { organization, membership, user } = await createOrgForUser(agent, {
      name: 'Vendor Org',
      slug: 'vendor-org'
    });

    membership.buyerSuiteEnabled = false;
    await membership.save();
    organization.buyerSuiteEnabled = false;
    organization.vendorSuiteEnabled = true;
    organization.sharedSuiteEnabled = true;
    await organization.save();

    const partnerOrg = await seedSharedOrg();

    await RevenueAccount.create({ userId: user._id, name: 'Key Account' });
    await BuyerValueAssessment.create({
      vendorName: 'Value',
      title: 'Seller Assessment',
      createdBy: user._id,
      organization: null
    });
    await ProcurementVendor.create({
      organization: organization._id,
      userId: user._id,
      name: 'Should Not Leak'
    });
    await EngagementRoom.create({
      title: 'Room A',
      vendorOrg: organization._id,
      buyerOrg: partnerOrg._id,
      createdBy: user._id
    });

    const res = await agent.get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.overview.vendor).toMatchObject({
      revenueAccounts: { total: 1 },
      valueSphere: { sellerAssessments: 1 }
    });
    expect(res.body.overview.buyer).toBe(null);
    expect(res.body.overview.shared).toMatchObject({ engagementRooms: { total: 1 } });
  });

  test('buyer-only user gets buyer widgets and no vendor data', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Buyer User',
      email: 'buyer@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const { organization, membership, user } = await createOrgForUser(agent, {
      name: 'Buyer Org',
      slug: 'buyer-org'
    });

    membership.vendorSuiteEnabled = false;
    membership.buyerSuiteEnabled = true;
    membership.sharedSuiteEnabled = true;
    await membership.save();
    organization.vendorSuiteEnabled = false;
    organization.buyerSuiteEnabled = true;
    organization.sharedSuiteEnabled = true;
    await organization.save();

    const partnerOrg = await seedSharedOrg();

    await ProcurementVendor.create({ organization: organization._id, userId: user._id, name: 'Supplier' });
    await BuyerValueAssessment.create({
      organization: organization._id,
      procurementVendor: null,
      vendorName: 'Supplier',
      title: 'Buyer Assessment',
      createdBy: user._id
    });
    await RevenueAccount.create({ userId: user._id, name: 'Should Not Appear' });
    await EngagementRoom.create({
      title: 'Room B',
      vendorOrg: partnerOrg._id,
      buyerOrg: organization._id,
      createdBy: user._id
    });

    const res = await agent.get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.overview.buyer).toMatchObject({
      procurementVendors: { total: 1 },
      valueSphere: { buyerAssessments: 1 }
    });
    expect(res.body.overview.vendor).toBe(null);
    expect(res.body.overview.shared).toMatchObject({ engagementRooms: { total: 1 } });
  });

  test('dual-suite users see all dashboard widgets', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      name: 'Dual User',
      email: 'dual@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const { organization, user } = await createOrgForUser(agent, {
      name: 'Dual Org',
      slug: 'dual-org'
    });

    const partnerOrg = await seedSharedOrg();

    await RevenueAccount.create({ userId: user._id, name: 'Dual Account' });
    await ProcurementVendor.create({ organization: organization._id, userId: user._id, name: 'Dual Vendor' });
    await BuyerValueAssessment.create({
      organization: organization._id,
      procurementVendor: null,
      vendorName: 'Dual Vendor',
      title: 'Buyer VS Assessment',
      createdBy: user._id
    });
    await BuyerValueAssessment.create({
      organization: null,
      vendorName: 'Seller VS',
      title: 'Seller VS Assessment',
      createdBy: user._id
    });
    await EngagementRoom.create({
      title: 'Room C',
      vendorOrg: organization._id,
      buyerOrg: partnerOrg._id,
      createdBy: user._id
    });

    const res = await agent.get('/api/dashboard/overview');
    expect(res.status).toBe(200);
    expect(res.body.overview.vendor).toMatchObject({
      revenueAccounts: { total: 1 },
      valueSphere: { sellerAssessments: 1 }
    });
    expect(res.body.overview.buyer).toMatchObject({
      procurementVendors: { total: 1 },
      valueSphere: { buyerAssessments: 1 }
    });
    expect(res.body.overview.shared).toMatchObject({ engagementRooms: { total: 1 } });
  });
});
