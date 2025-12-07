process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.OPENAI_API_KEY = 'test-openai';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub } = require('./helpers/workosStub');
const BuyerValueAssessment = require('../models/BuyerValueAssessment');
const ProcurementVendor = require('../models/ProcurementVendor');
const ValueSphereTemplate = require('../models/ValueSphereTemplate');
const EngagementRoom = require('../models/EngagementRoom');
const EngagementRoomMembership = require('../models/EngagementRoomMembership');
const RevenueAccount = require('../models/RevenueAccount');

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

describe('ValueSphere buyer flows', () => {
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

  test('template lifecycle supports versioning and retrieval', async () => {
    const agent = request.agent(app);
    const signupRes = await signup(agent, {
      name: 'Buyer',
      email: 'buyer@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    expect(signupRes.status).toBe(200);

    const orgRes = await createOrg(agent, 'Buyer Org', 'buyer-org');
    expect(orgRes.status).toBe(201);

    const createTemplate = await agent.post('/api/valuesphere/templates').send({
      name: 'Initial Buyer Template',
      description: 'Template v1',
      sections: [
        {
          sectionId: 'requirements',
          title: 'Requirements',
          questions: [
            { questionId: 'q1', label: 'Fit', type: 'text', weight: 0.5 },
            { questionId: 'q2', label: 'Risk', type: 'numeric', weight: 0.5 }
          ]
        }
      ]
    });
    expect(createTemplate.status).toBe(201);
    expect(createTemplate.body.template.versionNumber).toBe(1);

    const updateTemplate = await agent
      .patch(`/api/valuesphere/templates/${createTemplate.body.template.id}`)
      .send({
        name: 'Updated Template',
        changeSummary: 'Added pricing section',
        sections: [
          {
            sectionId: 'requirements',
            title: 'Requirements',
            questions: [{ questionId: 'q1', label: 'Fit', type: 'text', weight: 1 }]
          },
          { sectionId: 'pricing', title: 'Pricing', weight: 0.3, questions: [] }
        ]
      });
    expect(updateTemplate.status).toBe(200);
    expect(updateTemplate.body.template.versionNumber).toBe(2);

    const listTemplates = await agent.get('/api/valuesphere/templates');
    expect(listTemplates.status).toBe(200);
    expect(listTemplates.body.templates).toHaveLength(1);
    expect(listTemplates.body.templates[0].versionNumber).toBe(2);

    const deprecated = await ValueSphereTemplate.findById(createTemplate.body.template.id);
    expect(deprecated.isDeprecated).toBe(true);

    const getTemplate = await agent.get(`/api/valuesphere/templates/${updateTemplate.body.template.id}`);
    expect(getTemplate.status).toBe(200);
    expect(getTemplate.body.template.sections).toHaveLength(2);
  });

  test('assessment lifecycle with links and state transitions', async () => {
    const agent = request.agent(app);
    const signupRes = await signup(agent, {
      name: 'Buyer',
      email: 'buyer2@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    expect(signupRes.status).toBe(200);
    const orgRes = await createOrg(agent, 'Buyer Org', 'buyer-org2');
    const orgId = orgRes.body.organization.id;

    const templateRes = await agent.post('/api/valuesphere/templates').send({
      name: 'Assessment Template',
      sections: [
        { sectionId: 'sec1', title: 'Tech Fit', weight: 0.6, questions: [{ questionId: 'q1', label: 'API', type: 'text' }] }
      ]
    });
    const templateId = templateRes.body.template.id;

    const vendor = await ProcurementVendor.create({ organization: orgId, name: 'Vendor A', userId: signupResId(signupRes) });
    const room = await EngagementRoom.create({
      title: 'Room',
      vendorOrg: orgId,
      buyerOrg: orgId,
      createdBy: signupResId(signupRes)
    });
    await EngagementRoomMembership.create({ room: room._id, user: signupResId(signupRes), organization: orgId, role: 'editor' });
    const revenueAccount = await RevenueAccount.create({ userId: signupResId(signupRes), name: 'Account A' });

    const assessmentCreate = await agent.post('/api/valuesphere/buyer/assessments').send({
      vendorId: vendor._id.toString(),
      templateId,
      roomId: room._id.toString(),
      revenueAccountId: revenueAccount._id.toString(),
      vendorName: 'Vendor A',
      title: 'Evaluation',
      criteria: [{ sectionId: 'sec1', questionId: 'q1', score: 8, weight: 0.6 }],
      scoring: { totalScore: 8 },
      stakeholders: [{ name: 'Procurement Lead', role: 'Lead', influence: 'high' }]
    });
    expect(assessmentCreate.status).toBe(201);
    expect(assessmentCreate.body.assessment.procurementVendor).toBe(vendor._id.toString());
    expect(assessmentCreate.body.assessment.engagementRoom).toBe(room._id.toString());
    expect(assessmentCreate.body.assessment.revenueAccount).toBe(revenueAccount._id.toString());

    const assessmentId = assessmentCreate.body.assessment.id;

    const editAssessment = await agent.patch(`/api/valuesphere/buyer/assessments/${assessmentId}`).send({
      scoring: { totalScore: 9, normalizedScore: 0.9 },
      decision: { status: 'shortlist', justification: 'Strong fit' },
      state: 'shared'
    });
    expect(editAssessment.status).toBe(200);
    expect(editAssessment.body.assessment.scoring.totalScore).toBe(9);
    expect(editAssessment.body.assessment.state).toBe('shared');

    const agreeAssessment = await agent.patch(`/api/valuesphere/buyer/assessments/${assessmentId}`).send({ state: 'agreed' });
    expect(agreeAssessment.status).toBe(200);
    expect(agreeAssessment.body.assessment.state).toBe('agreed');

    const lockAssessment = await agent.patch(`/api/valuesphere/buyer/assessments/${assessmentId}`).send({ state: 'locked' });
    expect(lockAssessment.status).toBe(200);
    expect(lockAssessment.body.assessment.state).toBe('locked');

    const invalidTransition = await agent
      .patch(`/api/valuesphere/buyer/assessments/${assessmentId}`)
      .send({ state: 'shared' });
    expect(invalidTransition.status).toBe(400);
  });

  test('enforces buyer suite permissions for assessments', async () => {
    const agent = request.agent(app);
    await signup(agent, {
      name: 'Seller',
      email: 'seller@example.com',
      password: 'password123',
      licenseTier: 'business',
      platformAccess: ['valuesphere']
    });
    const orgRes = await createOrg(agent, 'Vendor Org', 'vendor-suite');
    const orgId = orgRes.body.organization.id;

    // Downgrade membership to remove buyer suite access
    await mongoose.connection.collection('organizationmemberships').updateOne(
      { organization: new mongoose.Types.ObjectId(orgId) },
      { $set: { buyerSuiteEnabled: false, vendorSuiteEnabled: true } }
    );

    const templateAttempt = await agent.post('/api/valuesphere/templates').send({
      name: 'Denied',
      sections: []
    });
    expect(templateAttempt.status).toBe(403);

    const assessmentAttempt = await agent.post('/api/valuesphere/buyer/assessments').send({
      vendorName: 'Vendor',
      title: 'Forbidden'
    });
    expect(assessmentAttempt.status).toBe(403);
  });
});

function signupResId(signupResponse) {
  return signupResponse?.body?.user?.id || signupResponse?.body?.id;
}
