const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Vendor = require('../models/Vendor');
const RfpTemplate = require('../models/RfpTemplate');
const Entitlement = require('../models/Entitlement');
const User = require('../models/User');

let app;
let mongoServer;

function agent() {
  return request.agent(app);
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'vendors-test-secret';
  process.env.ALLOWED_ORIGINS = '';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  app = require('../index');
  await app.ensureMongoConnection();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
  }
});

async function bootstrapProject(client) {
  await client.post('/api/auth/signup').send({
    email: 'owner@example.com',
    password: 'Password123!',
    name: 'Owner',
    company: 'Acme',
    industry: 'Tech'
  });

  const projectRes = await client.post('/api/projects').send({
    name: 'Modernisation',
    industry: 'Technology',
    region: 'EMEA',
    companySize: 'Scale-up',
    capabilityFocus: ['Observability']
  });
  const user = await User.findOne({ email: 'owner@example.com' });
  await Entitlement.create({ userId: user._id, tier: 'strategic' });
  return projectRes.body.project.id;
}

describe('Vendor search and RFP endpoints', () => {
  test('returns vendor shortlist ranked by heuristics', async () => {
    const client = agent();
    const projectId = await bootstrapProject(client);

    await Vendor.create([
      {
        slug: 'alpha-observe',
        name: 'Alpha Observe',
        categories: ['Observability', 'Automation'],
        strengths: ['Closed-loop remediation', 'Cloud native integrations'],
        caveats: ['Premium pricing'],
        pricingNotes: 'Enterprise tier starts $180k',
        integrationMatrix: { snowflake: 'Certified' }
      },
      {
        slug: 'beta-ops',
        name: 'Beta Ops',
        categories: ['Monitoring'],
        strengths: ['Easy onboarding'],
        caveats: ['Limited automation']
      }
    ]);

    const res = await client.post('/api/vendors/search').send({
      projectId,
      capability: 'Observability',
      categories: ['Observability'],
      constraints: { integrationNeeds: ['Snowflake'] }
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.matches)).toBe(true);
    expect(res.body.matches[0].slug).toBe('alpha-observe');
  });

  test('materialises RFP draft and exports docx', async () => {
    const client = agent();
    const projectId = await bootstrapProject(client);

    await RfpTemplate.create({
      slug: 'observability-template',
      capability: 'Observability',
      sections: [
        { title: 'Operating model', prompts: ['Describe escalation workflow'] },
        { title: 'Automation', prompts: ['Outline remediation tooling integrations'] }
      ],
      criteria: [{ title: 'Automation depth', weight: 40 }]
    });

    const res = await client.post('/api/rfp/templates/materialize').send({
      projectId,
      templateSlug: 'observability-template',
      capability: 'Observability',
      criteria: [{ title: 'Roadmap clarity', weight: 20 }],
      questions: [{ section: 'Automation', prompt: 'How do you support proactive remediation?' }],
      stakeholders: [{ name: 'CTO', role: 'Sponsor' }],
      timeline: { phases: [{ name: 'Evaluation', durationWeeks: 6 }] }
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.draft.capability).toBe('Observability');
    expect(Array.isArray(res.body.draft.criteria)).toBe(true);

    const exportRes = await client.get(`/api/rfp/${res.body.draft._id}/export`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });
});
