process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.WORKOS_WEBHOOK_SECRET = 'test-webhook-secret';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub, FakeWorkOS } = require('./helpers/workosStub');
const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');

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

describe('WorkOS webhook endpoint', () => {
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
    FakeWorkOS.mockEvent = null;
  });

  test('accepts valid webhook payloads', async () => {
    const res = await request(app)
      .post('/api/webhooks/workos')
      .set('Content-Type', 'application/json')
      .set('workos-signature', 'test')
      .send({ message: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('syncs WorkOS users into Mongo', async () => {
    FakeWorkOS.mockEvent = {
      id: 'evt_user',
      event: 'user.created',
      data: {
        object: 'user',
        id: 'user_123',
        email: 'Person@example.com',
        first_name: 'Person',
        last_name: 'Example',
        state: 'active'
      }
    };

    const res = await request(app)
      .post('/api/webhooks/workos')
      .set('Content-Type', 'application/json')
      .set('workos-signature', 'test')
      .send({});

    expect(res.status).toBe(200);

    const user = await User.findOne({ workosUserId: 'user_123' });
    expect(user).toBeTruthy();
    expect(user.name).toBe('Person Example');
    expect(user.email).toBe('person@example.com');
    expect(user.status).toBe('active');
    expect(user.authSource).toBe('workos');
  });

  test('syncs WorkOS organizations into Mongo', async () => {
    FakeWorkOS.mockEvent = {
      id: 'evt_org',
      event: 'organization.created',
      data: {
        object: 'organization',
        id: 'org_123',
        name: 'Example Org',
        domains: [{ domain: 'example.com' }]
      }
    };

    const res = await request(app)
      .post('/api/webhooks/workos')
      .set('Content-Type', 'application/json')
      .set('workos-signature', 'test')
      .send({});

    expect(res.status).toBe(200);

    const org = await Organization.findOne({ workosOrganizationId: 'org_123' });
    expect(org).toBeTruthy();
    expect(org.name).toBe('Example Org');
    expect(org.domains).toEqual(['example.com']);
    expect(org.tier).toBe('business');
    expect(org.platformAccess).toEqual(['valuesphere']);
  });

  test('syncs WorkOS memberships into Mongo', async () => {
    FakeWorkOS.mockEvent = {
      id: 'evt_membership',
      event: 'organization_membership.created',
      data: {
        object: 'organization_membership',
        id: 'om_123',
        user_id: 'user_999',
        organization_id: 'org_999',
        role: { slug: 'admin' },
        status: 'active',
        user: {
          object: 'user',
          id: 'user_999',
          email: 'member@example.com',
          first_name: 'Membership',
          last_name: 'User'
        },
        organization: {
          object: 'organization',
          id: 'org_999',
          name: 'Membership Org',
          domains: [{ domain: 'membership.com' }]
        }
      }
    };

    const res = await request(app)
      .post('/api/webhooks/workos')
      .set('Content-Type', 'application/json')
      .set('workos-signature', 'test')
      .send({});

    expect(res.status).toBe(200);

    const org = await Organization.findOne({ workosOrganizationId: 'org_999' });
    const user = await User.findOne({ workosUserId: 'user_999' });
    const membership = await OrganizationMembership.findOne({ organization: org._id, user: user._id });

    expect(org).toBeTruthy();
    expect(user).toBeTruthy();
    expect(membership).toBeTruthy();
    expect(membership.role).toBe('admin');
    expect(membership.status).toBe('active');
    expect(membership.roleOrigin).toBe('idp');
  });
});
