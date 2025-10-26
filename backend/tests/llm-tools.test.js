const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Vendor = require('../models/Vendor');
const { scoringCompute, vendorMatch, calcFinancials, ragQuery } = require('../utils/llm-tools');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoServer.getUri());
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

describe('LLM local tools', () => {
  test('scoring compute derives headline score and pillar scores', async () => {
    const summary = await scoringCompute({
      answers: {
        Tech: { q1: { maturity: 4 }, q2: { maturity: 3, urgency: 4 } },
        People: { q1: { maturity: 2 }, q2: { maturity: 2 } }
      },
      vertical: 'saas'
    });

    expect(summary.headlineScore).toBeGreaterThan(0);
    expect(typeof summary.pillarScores.Tech).toBe('number');
    expect(typeof summary.pillarScores.People).toBe('number');
    expect(summary.benchmarks).toBeDefined();
  });

  test('vendor match ranks vendors by alignment', async () => {
    await Vendor.create([
      {
        slug: 'alpha-observe',
        name: 'Alpha Observe',
        categories: ['Observability', 'Automation'],
        strengths: ['Closed-loop remediation', 'Cloud native integrations'],
        caveats: ['Premium pricing'],
        pricingNotes: 'Enterprise tier starts $180k',
        integrationMatrix: { snowflake: 'Certified', datadog: 'Native' }
      },
      {
        slug: 'beta-ops',
        name: 'Beta Ops',
        categories: ['Monitoring'],
        strengths: ['Easy onboarding'],
        caveats: ['Limited automation'],
        pricingNotes: 'Mid-market focus'
      }
    ]);

    const result = await vendorMatch({
      capability: 'Observability',
      categories: ['Observability'],
      constraints: { integrationNeeds: ['Snowflake'] }
    });

    expect(Array.isArray(result.matches)).toBe(true);
    expect(result.matches[0].slug).toBe('alpha-observe');
    expect(result.matches[0].reasons.length).toBeGreaterThan(0);
  });

  test('financial calculator returns payback and NPV', () => {
    const result = calcFinancials({ investment: 500000, annualBenefit: 300000, durationMonths: 24, discountRate: 0.08 });
    expect(result.monthlyBenefit).toBeCloseTo(25000);
    expect(result.paybackMonths).toBeCloseTo(20);
    expect(result.npv).toBeGreaterThan(0);
  });

  test('rag query returns empty array placeholder', () => {
    expect(ragQuery({ query: 'Zero-touch compliance' })).toEqual([]);
  });
});
