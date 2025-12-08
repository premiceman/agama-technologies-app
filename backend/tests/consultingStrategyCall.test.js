process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
process.env.WORKOS_API_KEY = 'test-api-key';
process.env.WORKOS_CLIENT_ID = 'test-client-id';
process.env.OPENAI_API_KEY = 'test-openai-key';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const emailService = require('../services/email');

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

describe('Consulting strategy call endpoint', () => {
  beforeAll(async () => {
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
    emailService.__resetTransport();
    await mongoose.disconnect();
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
    }
    emailService.__resetTransport();
  });

  test('rejects invalid payloads with validation details', async () => {
    const res = await request(app).post('/api/consulting/strategy-call').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_FAILED');
    expect(res.body.details.name).toBeDefined();
    expect(res.body.details.focusAreas).toBeDefined();
  });

  test('sends an email when payload is valid', async () => {
    const sent = [];
    emailService.__setTransport({
      async sendMail(message) {
        sent.push(message);
      }
    });

    const payload = {
      name: 'Ada Lovelace',
      company: 'Analytical Engines',
      role: 'CTO',
      email: 'ada@example.com',
      region: 'GMT',
      focusAreas: ['Observability', 'Security'],
      challengeDescription: 'We need a better observability strategy.',
      timeline: '0–3 months',
      budgetBand: '$50-150k'
    };

    const res = await request(app).post('/api/consulting/strategy-call').send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('sales@agamatechnologies.com');
    expect(sent[0].subject).toContain(payload.company);
    expect(sent[0].text).toContain(payload.challengeDescription);
  });

  test('returns an error when email sending fails', async () => {
    emailService.__setTransport({
      async sendMail() {
        throw new Error('SMTP unavailable');
      }
    });

    const res = await request(app)
      .post('/api/consulting/strategy-call')
      .send({
        name: 'Grace Hopper',
        company: 'Compilers Inc',
        role: 'Engineer',
        email: 'grace@example.com',
        focusAreas: ['Other'],
        challengeDescription: 'Need help with strategy.'
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Unable to submit/);
  });
});
