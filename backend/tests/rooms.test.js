process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.OPENAI_API_KEY = 'test-openai';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub } = require('./helpers/workosStub');

let app;
let mongo;
let originalFetch;

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

describe('Engagement rooms', () => {
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
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
    }
    if (originalFetch) {
      global.fetch = originalFetch;
      originalFetch = null;
    }
  });

  test('lists rooms only for members', async () => {
    const ownerAgent = request.agent(app);
    await signup(ownerAgent, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const vendor = await createOrg(ownerAgent, 'Vendor Org', 'vendor-org');
    const buyer = await createOrg(ownerAgent, 'Buyer Org', 'buyer-org');

    const roomRes = await ownerAgent.post('/api/rooms').send({
      title: 'Important Room',
      vendorOrg: vendor.body.organization.id,
      buyerOrg: buyer.body.organization.id
    });
    expect(roomRes.status).toBe(201);

    const listRes = await ownerAgent.get('/api/rooms');
    expect(listRes.status).toBe(200);
    expect(listRes.body.rooms).toHaveLength(1);

    const outsider = request.agent(app);
    await signup(outsider, {
      name: 'Other User',
      email: 'other@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const outsiderList = await outsider.get('/api/rooms');
    expect(outsiderList.status).toBe(200);
    expect(outsiderList.body.rooms).toHaveLength(0);
  });

  test('prevents guest directory search and supports invites', async () => {
    const adminAgent = request.agent(app);
    await signup(adminAgent, {
      name: 'Admin',
      email: 'admin@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const orgA = await createOrg(adminAgent, 'Org A', 'orga');
    const orgB = await createOrg(adminAgent, 'Org B', 'orgb');
    const room = await adminAgent.post('/api/rooms').send({
      title: 'Invite Room',
      vendorOrg: orgA.body.organization.id,
      buyerOrg: orgB.body.organization.id
    });
    expect(room.status).toBe(201);

    const guestAgent = request.agent(app);
    await signup(guestAgent, {
      name: 'Guest',
      email: 'guest@example.com',
      password: 'password123',
      licenseTier: 'guest',
      platformAccess: ['valuesphere']
    });
    const searchRes = await guestAgent.get('/api/org/users/search?q=any');
    expect(searchRes.status).toBe(403);

    const inviteRes = await adminAgent
      .post(`/api/rooms/${room.body.room.id}/invites`)
      .send({ email: 'guest@example.com', organization: orgA.body.organization.id, role: 'viewer', isGuestInvite: true });
    expect(inviteRes.status).toBe(201);

    const invitesList = await adminAgent.get(`/api/rooms/${room.body.room.id}/invites`);
    expect(invitesList.status).toBe(200);
    expect(invitesList.body.invites[0]).toMatchObject({ email: 'guest@example.com', isGuestInvite: true });
  });

  test('enforces issue permissions and updates issues', async () => {
    const adminAgent = request.agent(app);
    await signup(adminAgent, {
      name: 'Admin User',
      email: 'admin2@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const orgA = await createOrg(adminAgent, 'Org C', 'orgc');
    const orgB = await createOrg(adminAgent, 'Org D', 'orgd');
    const room = await adminAgent.post('/api/rooms').send({
      title: 'Board Room',
      vendorOrg: orgA.body.organization.id,
      buyerOrg: orgB.body.organization.id
    });
    const roomId = room.body.room.id;

    const viewerAgent = request.agent(app);
    await signup(viewerAgent, {
      name: 'Viewer User',
      email: 'viewer@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });

    const addViewer = await adminAgent
      .post(`/api/rooms/${roomId}/members`)
      .send({ userId: (await viewerAgent.get('/api/auth/me')).body.user.id, organization: orgA.body.organization.id, role: 'viewer' });
    expect(addViewer.status).toBe(201);

    const viewerIssue = await viewerAgent
      .post(`/api/rooms/${roomId}/issues`)
      .send({ title: 'Viewer issue', status: 'not_started' });
    expect(viewerIssue.status).toBe(403);

    const issueCreate = await adminAgent
      .post(`/api/rooms/${roomId}/issues`)
      .send({ title: 'Admin issue', status: 'in_progress', priority: 'high' });
    expect(issueCreate.status).toBe(201);

    const issueId = issueCreate.body.issue.id;
    const issueUpdate = await adminAgent
      .patch(`/api/rooms/${roomId}/issues/${issueId}`)
      .send({ status: 'completed', notes: 'Resolved' });
    expect(issueUpdate.status).toBe(200);
    expect(issueUpdate.body.issue.status).toBe('completed');
    expect(issueUpdate.body.issue.notes).toBe('Resolved');
  });

  test('returns AI summaries and file validation payloads', async () => {
    const adminAgent = request.agent(app);
    await signup(adminAgent, {
      name: 'AI Admin',
      email: 'aiadmin@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const orgA = await createOrg(adminAgent, 'Org E', 'orge');
    const orgB = await createOrg(adminAgent, 'Org F', 'orgf');
    const room = await adminAgent.post('/api/rooms').send({
      title: 'AI Room',
      vendorOrg: orgA.body.organization.id,
      buyerOrg: orgB.body.organization.id
    });
    const roomId = room.body.room.id;

    originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: 'ok', risks: [], missingItems: [], recommendations: [] }) } }] })
    });

    const summaryRes = await adminAgent.post(`/api/rooms/${roomId}/ai/summary`).send({ timeWindowHours: 24 });
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.summary).toMatchObject({ summary: 'ok', risks: [], missingItems: [], recommendations: [] });

    const filePayload = {
      name: 'test.txt',
      mimeType: 'text/plain',
      sizeBytes: 5,
      base64: Buffer.from('hello').toString('base64')
    };
    const fileRes = await adminAgent.post(`/api/rooms/${roomId}/files`).send(filePayload);
    const fileId = fileRes.body.file.id;

    const validateRes = await adminAgent
      .post(`/api/rooms/${roomId}/files/${fileId}/validate`)
      .send({ context: 'Check content' });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.validation.summary).toBe('ok');
  });
});
