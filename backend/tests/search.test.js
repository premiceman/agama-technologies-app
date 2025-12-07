process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.OPENAI_API_KEY = 'test-openai';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub } = require('./helpers/workosStub');
const SearchIndexEntry = require('../models/SearchIndexEntry');

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

async function signup(agent, payload) {
  return agent.post('/api/auth/signup').send(payload);
}

async function createOrg(agent, name, slug) {
  return agent.post('/api/orgs').send({ name, slug });
}

describe('Search indexing', () => {
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

  test('indexes procurement vendors and enforces org scoping', async () => {
    const owner = request.agent(app);
    await signup(owner, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'password123',
    });
    await createOrg(owner, 'Buyer Org', 'buyer-org');

    const vendorRes = await owner.post('/api/procurepath/vendors').send({ name: 'Alpha Vendor', domain: 'alpha.com' });
    expect(vendorRes.status).toBe(201);
    const vendorId = vendorRes.body.vendor._id;

    const searchRes = await owner.get('/api/search').query({ q: 'Alpha', entityType: 'procurement_vendor' });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.results).toHaveLength(1);
    expect(searchRes.body.results[0].title).toBe('Alpha Vendor');

    const updateRes = await owner.put(`/api/procurepath/vendors/${vendorId}`).send({ name: 'Beta Vendor' });
    expect(updateRes.status).toBe(200);

    const searchResUpdated = await owner.get('/api/search').query({ q: 'Beta', entityType: 'procurement_vendor' });
    expect(searchResUpdated.status).toBe(200);
    expect(searchResUpdated.body.results).toHaveLength(1);
    expect(searchResUpdated.body.results[0].title).toBe('Beta Vendor');

    const outsider = request.agent(app);
    await signup(outsider, {
      name: 'Other',
      email: 'other@example.com',
      password: 'password123',
    });
    await createOrg(outsider, 'Another Org', 'another-org');

    const outsiderSearch = await outsider.get('/api/search').query({ q: 'Vendor', entityType: 'procurement_vendor' });
    expect(outsiderSearch.status).toBe(200);
    expect(outsiderSearch.body.results).toHaveLength(0);
  });

  test('reindex rebuilds missing entries', async () => {
    const agent = request.agent(app);
    await signup(agent, {
      name: 'Indexer',
      email: 'indexer@example.com',
      password: 'password123',
    });
    await createOrg(agent, 'Reindex Org', 'reindex-org');

    const vendorRes = await agent.post('/api/procurepath/vendors').send({ name: 'Gamma Vendor' });
    expect(vendorRes.status).toBe(201);

    await SearchIndexEntry.deleteMany({});

    const reindexRes = await agent.post('/api/search/reindex');
    expect(reindexRes.status).toBe(200);

    const searchRes = await agent.get('/api/search').query({ q: 'Gamma', entityType: 'procurement_vendor' });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.results).toHaveLength(1);
    expect(searchRes.body.results[0].title).toBe('Gamma Vendor');
  });
});
