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
    expect(contextRes.body.activeOrganization.id).toBe(orgOne.body.organization.id);
    const normalized = {
      ok: contextRes.body.ok,
      orgRole: contextRes.body.orgRole,
      suiteEntitlements: contextRes.body.suiteEntitlements,
      activePersona: contextRes.body.activePersona,
      themeHints: contextRes.body.themeHints,
      effectivePermissions: contextRes.body.effectivePermissions,
      activeOrganization: {
        ...contextRes.body.activeOrganization,
        id: '<org-one>',
        suites: contextRes.body.activeOrganization.suites
      },
      user: {
        email: contextRes.body.user.email,
        persona: contextRes.body.user.persona,
        defaultOrganizationId: contextRes.body.user.defaultOrganizationId ? '<org-one>' : null
      }
    };

    expect(normalized).toEqual({
      ok: true,
      orgRole: 'org_owner',
      suiteEntitlements: {
        buyerSuite: true,
        sharedSuite: true,
        vendorSuite: true
      },
      activePersona: 'shared',
      themeHints: { primary: 'shared', persona: 'shared' },
      effectivePermissions: {
        role: 'org_owner',
        entitlements: { buyerSuite: true, sharedSuite: true, vendorSuite: true },
        isOrgOwner: true,
        isOrgAdmin: false,
        canManageOrg: true,
        vendorSuiteAccess: true,
        buyerSuiteAccess: true,
        sharedSuiteAccess: true
      },
      activeOrganization: {
        id: '<org-one>',
        name: 'Context One',
        slug: 'context-one',
        tier: 'business',
        orgType: 'both',
        role: 'org_owner',
        suites: {
          organization: {
            vendorSuiteEnabled: true,
            buyerSuiteEnabled: true,
            sharedSuiteEnabled: true
          },
          membership: {
            vendorSuiteEnabled: true,
            buyerSuiteEnabled: true,
            sharedSuiteEnabled: true
          }
        }
      },
      user: {
        email: 'multiorg@example.com',
        persona: 'dual',
        defaultOrganizationId: '<org-one>'
      }
    });

    const secondOrgContext = await agent.get(`/api/me/context?orgId=${orgTwo.body.organization.id}`);
    expect(secondOrgContext.status).toBe(200);
    expect(secondOrgContext.body.activeOrganization.id).toBe(orgTwo.body.organization.id);
  });

  test('returns mixed suite access entitlements', async () => {
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
    membership.sharedSuiteEnabled = true;
    await membership.save();

    const contextRes = await agent.get(`/api/me/context?orgId=${orgId}`);
    expect(contextRes.status).toBe(200);
    const normalized = {
      ok: contextRes.body.ok,
      orgRole: contextRes.body.orgRole,
      suiteEntitlements: contextRes.body.suiteEntitlements,
      activePersona: contextRes.body.activePersona,
      themeHints: contextRes.body.themeHints,
      effectivePermissions: contextRes.body.effectivePermissions,
      activeOrganization: {
        ...contextRes.body.activeOrganization,
        id: '<org-id>',
        suites: contextRes.body.activeOrganization.suites
      },
      user: {
        email: contextRes.body.user.email,
        persona: contextRes.body.user.persona,
        defaultOrganizationId: contextRes.body.user.defaultOrganizationId ? '<org-id>' : null
      }
    };

    expect(normalized).toEqual({
      ok: true,
      orgRole: 'org_owner',
      suiteEntitlements: { buyerSuite: false, sharedSuite: true, vendorSuite: true },
      activePersona: 'seller',
      themeHints: { primary: 'seller', persona: 'seller' },
      effectivePermissions: {
        role: 'org_owner',
        entitlements: { buyerSuite: false, sharedSuite: true, vendorSuite: true },
        isOrgOwner: true,
        isOrgAdmin: false,
        canManageOrg: true,
        vendorSuiteAccess: true,
        buyerSuiteAccess: false,
        sharedSuiteAccess: true
      },
      activeOrganization: {
        id: '<org-id>',
        name: 'Mix Org',
        slug: 'mix-org',
        tier: 'business',
        orgType: 'both',
        role: 'org_owner',
        suites: {
          organization: {
            vendorSuiteEnabled: true,
            buyerSuiteEnabled: true,
            sharedSuiteEnabled: true
          },
          membership: {
            vendorSuiteEnabled: true,
            buyerSuiteEnabled: false,
            sharedSuiteEnabled: true
          }
        }
      },
      user: {
        email: 'mix@example.com',
        persona: 'dual',
        defaultOrganizationId: '<org-id>'
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
    const normalized = {
      ok: contextRes.body.ok,
      orgRole: contextRes.body.orgRole,
      suiteEntitlements: contextRes.body.suiteEntitlements,
      activePersona: contextRes.body.activePersona,
      themeHints: contextRes.body.themeHints,
      activeOrganization: {
        id: '<org-id>',
        name: contextRes.body.activeOrganization.name,
        slug: contextRes.body.activeOrganization.slug,
        tier: contextRes.body.activeOrganization.tier,
        orgType: contextRes.body.activeOrganization.orgType,
        role: contextRes.body.activeOrganization.role,
        suites: contextRes.body.activeOrganization.suites
      },
      user: {
        email: contextRes.body.user.email,
        persona: contextRes.body.user.persona,
        defaultOrganizationId: contextRes.body.user.defaultOrganizationId ? '<org-id>' : null
      }
    };

    expect(normalized).toEqual({
      ok: true,
      orgRole: 'org_owner',
      suiteEntitlements: { buyerSuite: true, sharedSuite: true, vendorSuite: true },
      activePersona: 'buyer',
      themeHints: { primary: 'buyer', persona: 'buyer' },
      activeOrganization: {
        id: '<org-id>',
        name: 'Buyer Org',
        slug: 'buyer-org',
        tier: 'business',
        orgType: 'both',
        role: 'org_owner',
        suites: {
          organization: {
            vendorSuiteEnabled: true,
            buyerSuiteEnabled: true,
            sharedSuiteEnabled: true
          },
          membership: {
            vendorSuiteEnabled: true,
            buyerSuiteEnabled: true,
            sharedSuiteEnabled: true
          }
        }
      },
      user: {
        email: 'buyer@example.com',
        persona: 'buyer',
        defaultOrganizationId: '<org-id>'
      }
    });
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
