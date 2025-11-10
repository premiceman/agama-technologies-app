const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const MaturityTimepoint = require('../models/MaturityTimepoint');
const BusinessMetric = require('../models/BusinessMetric');
const Initiative = require('../models/Initiative');
const { recomputeProjectAnalytics } = require('../utils/project-analytics');

let app;
let mongoServer;

function agent() {
  return request.agent(app);
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'analytics-test-secret';
  process.env.ALLOWED_ORIGINS = '';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  app = require('../index');
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

describe('Project analytics endpoints', () => {
  async function bootstrapProject(client) {
    await client.post('/api/auth/signup').send({
      email: 'owner@example.com',
      password: 'Password123!',
      name: 'Owner',
      company: 'Acme',
      industry: 'Tech'
    });
    const projectRes = await client.post('/api/projects').send({
      name: 'Project A',
      industry: 'Technology',
      region: 'EMEA',
      companySize: 'SMB'
    });
    const projectId = projectRes.body.project.id;
    return projectId;
  }

  test('analytics summary aggregates maturity, business metrics, and attribution', async () => {
    const client = agent();
    const projectId = await bootstrapProject(client);
    const projectObjectId = new mongoose.Types.ObjectId(projectId);

    const firstAssessmentId = new mongoose.Types.ObjectId();
    const secondAssessmentId = new mongoose.Types.ObjectId();

    await MaturityTimepoint.create([
      {
        projectId: projectObjectId,
        assessmentId: firstAssessmentId,
        domain: 'security',
        scores: {
          overall: 60,
          pillars: { Tech: 55, Data: 52, People: 50, Process: 48 }
        },
        computedAt: new Date('2024-01-01T00:00:00Z')
      },
      {
        projectId: projectObjectId,
        assessmentId: secondAssessmentId,
        domain: 'security',
        scores: {
          overall: 72,
          pillars: { Tech: 70, Data: 60, People: 58, Process: 55 }
        },
        computedAt: new Date('2024-03-01T00:00:00Z')
      }
    ]);

    await BusinessMetric.create([
      {
        projectId: projectObjectId,
        year: 2022,
        arrUSD: 1200000,
        headcount: 90,
        source: { type: 'manual' }
      },
      {
        projectId: projectObjectId,
        year: 2023,
        arrUSD: 1800000,
        headcount: 110,
        source: { type: 'manual' }
      }
    ]);

    await Initiative.create({
      projectId: projectObjectId,
      title: 'Platform acceleration',
      description: 'Improve engineering throughput',
      startDate: new Date('2023-11-01T00:00:00Z'),
      endDate: new Date('2024-02-15T00:00:00Z'),
      impactedPillars: [{ pillar: 'Tech', expectedImpact: 2 }],
      status: 'done'
    });

    await recomputeProjectAnalytics(projectId);

    const summaryRes = await client.get(`/api/projects/${projectId}/analytics/summary`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.ok).toBe(true);
    expect(summaryRes.body.maturity.overall).toBeCloseTo(72);
    expect(summaryRes.body.maturity.delta.overall).toBeCloseTo(12);
    expect(Array.isArray(summaryRes.body.sparklines.overall)).toBe(true);
    expect(summaryRes.body.sparklines.overall).toHaveLength(2);
    expect(summaryRes.body.business.arr).toHaveLength(2);
    expect(summaryRes.body.business.headcount).toHaveLength(2);
    const attribution = summaryRes.body.changeAttribution.find(item => item.pillar === 'Tech');
    expect(attribution).toBeTruthy();
    expect(attribution.initiatives[0].title).toEqual('Platform acceleration');
  });

  test('maturity timeseries returns pillar history', async () => {
    const client = agent();
    const projectId = await bootstrapProject(client);
    const projectObjectId = new mongoose.Types.ObjectId(projectId);

    await MaturityTimepoint.create([
      {
        projectId: projectObjectId,
        assessmentId: new mongoose.Types.ObjectId(),
        domain: 'security',
        scores: { overall: 50, pillars: { Tech: 48 } },
        computedAt: new Date('2024-01-01T00:00:00Z')
      },
      {
        projectId: projectObjectId,
        assessmentId: new mongoose.Types.ObjectId(),
        domain: 'security',
        scores: { overall: 60, pillars: { Tech: 58 } },
        computedAt: new Date('2024-02-01T00:00:00Z')
      }
    ]);

    const seriesRes = await client.get(`/api/projects/${projectId}/maturity/timeseries?pillar=Tech`);
    expect(seriesRes.status).toBe(200);
    expect(seriesRes.body.ok).toBe(true);
    expect(seriesRes.body.series).toHaveLength(2);
    expect(seriesRes.body.series[1].value).toBeCloseTo(58);
  });

  test('CSV upload validation rejects invalid rows', async () => {
    const client = agent();
    const projectId = await bootstrapProject(client);
    const csvPayload = 'year,arrUSD\nnot-a-year,abc';
    const res = await client
      .post(`/api/projects/${projectId}/business/metrics/upload`)
      .set('Content-Type', 'text/csv')
      .send(csvPayload);
    expect(res.status).toBe(400);
  });
});
