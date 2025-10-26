const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Assessment = require('../models/Assessment');
const Project = require('../models/Project');
const { migrate } = require('../scripts/migrate-assessments-into-projects');

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ALLOWED_ORIGINS = '';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(process.env.MONGODB_URI);
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

describe('assessment migration script', () => {
  test('dry-run leaves assessments untouched', async () => {
    await Assessment.collection.insertOne({
      userId: new mongoose.Types.ObjectId(),
      assessmentType: 'security',
      stage: 'insight',
      companySize: 'SMB',
      region: 'EMEA',
      industry: 'Tech',
      vertical: 'generic',
      strategicDrivers: [],
      organization: {},
      projectSnapshot: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await migrate({ dryRun: true });

    const refreshed = await Assessment.find();
    expect(refreshed[0].projectId).toBe(undefined);
  });

  test('migration assigns default project', async () => {
    const userId = new mongoose.Types.ObjectId();
    const insert = await Assessment.collection.insertOne({
      userId,
      assessmentType: 'security',
      stage: 'insight',
      companySize: 'SMB',
      region: 'EMEA',
      industry: 'Tech',
      vertical: 'generic',
      strategicDrivers: ['Resilience'],
      organization: {},
      projectSnapshot: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const assessmentId = insert.insertedId;

    await migrate();

    const updated = await Assessment.findById(assessmentId);
    expect(updated.projectId).toBeDefined();
    const project = await Project.findById(updated.projectId);
    expect(project).toBeTruthy();
    expect(project.name).toBe('Auto-imported Project');
  });
});
