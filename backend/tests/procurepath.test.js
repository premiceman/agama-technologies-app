process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub } = require('./helpers/workosStub');

let app;
let mongo;

async function waitForConnection() {
  if (mongoose.connection.readyState === 1) return;
  await new Promise((resolve, reject) => {
    mongoose.connection.once('connected', resolve);
    mongoose.connection.once('error', reject);
  });
}

describe('ProcurePath vendors and RFX', () => {
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

  test('buyer suite user can manage vendor lifecycle and RFX', async () => {
    const agent = request.agent(app);
    const vendorOrgId = new mongoose.Types.ObjectId().toString();

    const signupRes = await agent.post('/api/auth/signup').send({
      name: 'Buyer User',
      email: 'buyer@example.com',
      password: 'password123',
    });

    expect(signupRes.status).toBe(200);

    const orgRes = await agent.post('/api/orgs').send({ name: 'Buyer Org', slug: 'buyer-org' });
    expect(orgRes.status).toBe(201);

    const vendorRes = await agent.post('/api/procurepath/vendors').send({
      name: 'SecurityCo',
      domainCategory: 'security',
      stage: 'discovery',
      riskLevel: 'high'
    });

    expect(vendorRes.status).toBe(201);
    expect(vendorRes.body.vendor.stage).toBe('discovery');

    const vendorId = vendorRes.body.vendor._id;

    const objectiveRes = await agent
      .post(`/api/procurepath/vendors/${vendorId}/objectives`)
      .send({ title: 'Improve SOC posture', status: 'on-track' });
    expect(objectiveRes.status).toBe(201);
    expect(objectiveRes.body.vendor.objectives.length).toBe(1);

    const touchpointRes = await agent
      .post(`/api/procurepath/vendors/${vendorId}/touchpoints`)
      .send({ summary: 'Kickoff call completed', type: 'meeting' });
    expect(touchpointRes.status).toBe(201);
    expect(touchpointRes.body.vendor.touchpoints.length).toBe(1);

    const rfxRes = await agent.post('/api/procurepath/rfx').send({
      topicArea: 'Security RFP',
      sections: [{ title: 'Security', order: 1, id: 'sec-1' }],
      items: [
        {
          sectionId: 'sec-1',
          prompt: 'Do you support SOC2?',
          type: 'text',
          order: 1
        }
      ],
      vendorIds: [vendorId]
    });

    expect(rfxRes.status).toBe(201);
    const rfxId = rfxRes.body.rfx._id;
    const questionId = rfxRes.body.items[0]._id;

    const updatedVendorList = await agent.get('/api/procurepath/vendors');
    expect(updatedVendorList.body.vendors[0].linkedRfx.includes(rfxId)).toBe(true);

    const patchRes = await agent.patch(`/api/procurepath/rfx/${rfxId}`).send({ status: 'responding' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.rfx.status).toBe('responding');

    const responseRes = await agent.post(`/api/procurepath/rfx/${rfxId}/responses`).send({
      vendorOrgId,
      responses: [
        {
          questionId,
          answerText: 'Yes, audited last year'
        }
      ]
    });

    expect(responseRes.status).toBe(201);
    expect(responseRes.body.responses.length).toBe(1);

    const fetchRes = await agent.get(`/api/procurepath/rfx/${rfxId}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.responses.length).toBe(1);
  });

  test('non-buyer users cannot access procurepath endpoints', async () => {
    const agent = request.agent(app);

    await agent.post('/api/auth/signup').send({
      name: 'Seller Only',
      email: 'seller@example.com',
      password: 'password123',
    });

    await agent.post('/api/orgs').send({ name: 'Seller Org', slug: 'seller-org' });

    const res = await agent.get('/api/procurepath/vendors');
    expect(res.status).toBe(403);
  });
});
