process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.WORKOS_WEBHOOK_SECRET = 'test-webhook-secret';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { installWorkOSStub } = require('./helpers/workosStub');

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

describe('WorkOS webhook endpoint', () => {
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

  test('accepts valid webhook payloads', async () => {
    const res = await request(app)
      .post('/api/webhooks/workos')
      .set('Content-Type', 'application/json')
      .set('workos-signature', 'test')
      .send({ message: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
