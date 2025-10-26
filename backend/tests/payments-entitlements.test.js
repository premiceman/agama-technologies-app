const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getStripe } = require('../utils/stripe');

const Report = require('../models/Report');
const Project = require('../models/Project');
const Entitlement = require('../models/Entitlement');
const Payment = require('../models/Payment');
const User = require('../models/User');

let app;
let mongoServer;
let mongoUri;

function agent() {
  return request.agent(app);
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.ALLOWED_ORIGINS = '';
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mocksecret';
  process.env.ADMIN_EMAILS = 'admin@example.com';
  app = require('../index');
});

beforeEach(async () => {
  mongoServer = await MongoMemoryServer.create();
  mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await app.ensureMongoConnection();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
    mongoUri = null;
  }
});

test('reports and premium endpoints respect entitlement tier', async () => {
  const client = agent();
  await client.post('/api/auth/signup').send({
    email: 'user@example.com',
    password: 'Password123!',
    name: 'User Tester'
  });

  const user = await User.findOne({ email: 'user@example.com' });
  const projectId = new mongoose.Types.ObjectId();
  await Project.create({
    _id: projectId,
    userId: user._id,
    name: 'Test Project',
    industry: 'Technology',
    region: 'EMEA',
    companySize: 'Mid-market'
  });

  const report = await Report.create({
    userId: user._id,
    projectId,
    assessmentId: new mongoose.Types.ObjectId(),
    vertical: 'Technology',
    assessmentType: 'security',
    stage: 'insight',
    summary: 'Executive summary',
    headlineScore: 62,
    pillarScores: { Technology: 62, Data: 58, People: 55, Process: 53 },
    benchmarks: { overall: 60, peers: { overall: 65 } },
    recommendations: ['Immediate action', 'Stabilise platform', 'Upskill team', 'Invest in analytics'],
    pillarInsights: { Technology: { status: 'Lagging' } },
    roadmap: { shortTerm: ['Stabilise core platform'] },
    structuredSections: {
      overview: { organisation: 'Example Corp', capabilityFocus: ['Security'], strategicDrivers: ['Resilience'] },
      technology: { architectureSignals: [{ layer: 'Platforms', observation: 'Legacy debt' }] },
      data: {},
      people: {},
      process: {}
    }
  });

  const previewRes = await client.get(`/api/reports/${report._id}`);
  expect(previewRes.status).toBe(200);
  expect(previewRes.body.entitlement.tier).toBe('free');
  expect(previewRes.body.report.access.hasPremium).toBe(false);
  expect(previewRes.body.report.roadmap).toBe(undefined);
  expect(previewRes.body.report.previewSections).toBeDefined();

  const vendorDenied = await client
    .post('/api/vendors/search')
    .send({ projectId: projectId.toString(), capability: 'security' });
  expect(vendorDenied.status).toBe(403);

  await Entitlement.create({ userId: user._id, tier: 'strategic' });

  const premiumRes = await client.get(`/api/reports/${report._id}`);
  expect(premiumRes.status).toBe(200);
  expect(premiumRes.body.entitlement.tier).toBe('strategic');
  expect(premiumRes.body.report.access.hasPremium).toBe(true);
  expect(premiumRes.body.report.roadmap).toBeDefined();

  const vendorAllowed = await client
    .post('/api/vendors/search')
    .send({ projectId: projectId.toString(), capability: 'security' });
  expect(vendorAllowed.status).toBe(200);
});

test('stripe webhook marks payment paid and grants entitlement', async () => {
  const user = await User.createSecure({
    email: 'payer@example.com',
    password: 'Password123!',
    name: 'Payer'
  });

  const payment = await Payment.create({
    userId: user._id,
    amountCents: 25000,
    currency: 'usd',
    provider: 'stripe',
    status: 'pending',
    tier: 'strategic',
    stripeSessionId: 'cs_test_session'
  });

  const eventPayload = {
    id: 'evt_test_checkout',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_session',
        object: 'checkout.session',
        mode: 'payment',
        amount_total: 25000,
        currency: 'usd',
        metadata: {
          userId: user._id.toString(),
          tier: 'strategic',
          paymentId: payment._id.toString()
        }
      }
    }
  };

  const stripe = getStripe();
  const payload = JSON.stringify(eventPayload);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET
  });

  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Stripe-Signature', header)
    .set('Content-Type', 'application/json')
    .send(payload);
  expect(res.status).toBe(200);

  const updatedPayment = await Payment.findById(payment._id).lean();
  expect(updatedPayment.status).toBe('paid');
  expect(updatedPayment.amountCents).toBe(25000);
  expect(updatedPayment.currency).toBe('usd');

  const entitlement = await Entitlement.findOne({ userId: user._id, tier: 'strategic' }).lean();
  expect(entitlement).toBeTruthy();
});
