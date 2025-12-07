process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.OPENAI_API_KEY = 'test-openai-key';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub } = require('./helpers/workosStub');
const Notification = require('../models/Notification');

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

describe('Notifications', () => {
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

  test('room events generate notifications and read endpoints update state', async () => {
    const ownerAgent = request.agent(app);
    await signup(ownerAgent, {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const vendorOrg = await createOrg(ownerAgent, 'Vendor Org', 'vendor-room');
    const buyerOrg = await createOrg(ownerAgent, 'Buyer Org', 'buyer-room');

    const memberAgent = request.agent(app);
    await signup(memberAgent, {
      name: 'Member',
      email: 'member@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const memberUserId = (await memberAgent.get('/api/auth/me')).body.user.id;

    const roomRes = await ownerAgent.post('/api/rooms').send({
      title: 'Notification Room',
      vendorOrg: vendorOrg.body.organization.id,
      buyerOrg: buyerOrg.body.organization.id
    });
    expect(roomRes.status).toBe(201);
    const roomId = roomRes.body.room.id;

    const addMemberRes = await ownerAgent.post(`/api/rooms/${roomId}/members`).send({
      userId: memberUserId,
      organization: vendorOrg.body.organization.id,
      role: 'editor'
    });
    expect(addMemberRes.status).toBe(201);

    const messageRes = await ownerAgent.post(`/api/rooms/${roomId}/messages`).send({ body: 'hello' });
    expect(messageRes.status).toBe(201);

    const listRes = await memberAgent.get('/api/notifications');
    expect(listRes.status).toBe(200);
    expect(listRes.body.notifications.length).toBeGreaterThan(0);
    const messageNotification = listRes.body.notifications.find(n => n.type === 'room.message.created');
    expect(messageNotification).toBeDefined();
    expect(messageNotification.read).toBe(false);

    const notificationId = messageNotification._id || messageNotification.id;
    const readRes = await memberAgent.post(`/api/notifications/${notificationId}/read`).send();
    expect(readRes.status).toBe(200);
    expect(readRes.body.notification.read).toBe(true);
    expect(readRes.body.notification.readAt).toBeTruthy();

    await ownerAgent.post(`/api/rooms/${roomId}/messages`).send({ body: 'Follow up' });
    const unreadBefore = await Notification.countDocuments({ userId: memberUserId, read: false });
    expect(unreadBefore).toBeGreaterThan(0);

    const markAll = await memberAgent.post('/api/notifications/mark-all-read').send();
    expect(markAll.status).toBe(200);
    expect(markAll.body.updated).toBe(unreadBefore);

    const unreadAfter = await Notification.countDocuments({ userId: memberUserId, read: false });
    expect(unreadAfter).toBe(0);
  });

  test('buyer workflows generate organization notifications', async () => {
    const adminAgent = request.agent(app);
    await signup(adminAgent, {
      name: 'Buyer Admin',
      email: 'buyer-admin@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['procurepath', 'valuesphere']
    });
    const orgRes = await createOrg(adminAgent, 'Buyer Org', 'buyer-org');
    const orgId = orgRes.body.organization.id;

    const evaluatorAgent = request.agent(app);
    await signup(evaluatorAgent, {
      name: 'Evaluator',
      email: 'evaluator@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['procurepath', 'valuesphere']
    });

    const addMember = await adminAgent.post(`/api/orgs/${orgId}/members`).send({
      email: 'evaluator@example.com',
      role: 'buyer_user',
      buyerSuiteEnabled: true,
      vendorSuiteEnabled: false,
      sharedSuiteEnabled: true
    });
    expect(addMember.status).toBe(201);

    const rfxRes = await adminAgent.post('/api/procurepath/rfx').send({
      topicArea: 'Security RFP',
      sections: [{ title: 'Sec', id: 'sec-1' }],
      items: [{ sectionId: 'sec-1', prompt: 'Do you encrypt data?', type: 'text' }]
    });
    expect(rfxRes.status).toBe(201);
    const rfxId = rfxRes.body.rfx._id;

    const responsesRes = await adminAgent.post(`/api/procurepath/rfx/${rfxId}/responses`).send({
      vendorOrgId: new mongoose.Types.ObjectId().toString(),
      responses: [{ questionId: rfxRes.body.items[0]._id, answerText: 'Yes' }]
    });
    expect(responsesRes.status).toBe(201);

    const assessmentRes = await adminAgent.post('/api/valuesphere/buyer/assessments').send({
      vendorName: 'SecurityCo',
      title: 'Security Assessment',
      criteria: [],
      responses: [],
      dimensions: []
    });
    expect(assessmentRes.status).toBe(201);

    const evaluatorNotifications = await evaluatorAgent.get('/api/notifications');
    expect(evaluatorNotifications.status).toBe(200);
    const notificationTypes = new Set(evaluatorNotifications.body.notifications.map(n => n.type));
    expect(notificationTypes.has('procurepath.rfx.created')).toBe(true);
    expect(notificationTypes.has('procurepath.rfx.response_recorded')).toBe(true);
    expect(notificationTypes.has('valuesphere.assessment.created')).toBe(true);
  });
});
