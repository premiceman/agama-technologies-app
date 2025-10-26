const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;

function agent() {
  return request.agent(app);
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
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

describe('Project-scoped assessments', () => {
  test('owner can CRUD assessments under project scope', async () => {
    const client = agent();
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

    const createRes = await client
      .post(`/api/projects/${projectId}/assessments`)
      .send({ stage: 'insight', assessmentType: 'security' });
    expect(createRes.status).toBe(200);
    expect(createRes.body.assessmentId).toBeDefined();

    const listRes = await client.get(`/api/projects/${projectId}/assessments`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.assessments).toHaveLength(1);

    const assessmentId = listRes.body.assessments[0]._id;
    const updateRes = await client
      .put(`/api/projects/${projectId}/assessments/${assessmentId}`)
      .send({ strategicDrivers: ['Resilience'], organization: { name: 'Acme Corp' } });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.stage).toBeDefined();

    const getRes = await client.get(`/api/projects/${projectId}/assessments/${assessmentId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.project.id).toEqual(projectId);
  });

  test('non-owner cannot access another project assessments', async () => {
    const owner = agent();
    await owner.post('/api/auth/signup').send({
      email: 'owner2@example.com',
      password: 'Password123!',
      name: 'Owner Two',
      industry: 'Finance'
    });
    const project = await owner.post('/api/projects').send({
      name: 'Project Secret',
      industry: 'Finance',
      region: 'AMER',
      companySize: 'Enterprise'
    });
    const projectId = project.body.project.id;

    const intruder = agent();
    await intruder.post('/api/auth/signup').send({
      email: 'intruder@example.com',
      password: 'Password123!',
      name: 'Intruder'
    });

    const forbiddenList = await intruder.get(`/api/projects/${projectId}/assessments`);
    expect(forbiddenList.status).toBe(403);

    const forbiddenCreate = await intruder
      .post('/api/assessments')
      .send({ projectId, stage: 'insight' });
    expect(forbiddenCreate.status).toBe(403);
  });
});
