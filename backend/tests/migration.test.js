const path = require('path');
const { execFile } = require('child_process');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Assessment = require('../models/Assessment');
const Project = require('../models/Project');

let mongoServer;

function runScript(args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'migrate-assessments-into-projects.js');
    execFile('node', [scriptPath, ...args], { env: { ...process.env } }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ALLOWED_ORIGINS = '';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
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

    await runScript(['--dry-run']);

    const refreshed = await Assessment.find();
    expect(refreshed[0].projectId).toBeUndefined();
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

    await runScript();

    const updated = await Assessment.findById(assessmentId);
    expect(updated.projectId).toBeDefined();
    const project = await Project.findById(updated.projectId);
    expect(project).not.toBeNull();
    expect(project.name).toBe('Auto-imported Project');
  });
});
