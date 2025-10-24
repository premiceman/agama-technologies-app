// Agama Technologies — Backend (Express + MongoDB)
// Serves static frontend from ./public and provides API for auth, assessments, reports, and mock payments.
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

// ---- Security & parsers ----
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- CORS ----
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked for origin: ' + origin));
  },
  credentials: true
}));

app.use(morgan('dev'));

// ---- MongoDB ----
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama_tech';
mongoose.set('strictQuery', true);
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });

// ---- Models ----
const User = require('./models/User');
const Assessment = require('./models/Assessment');
const Report = require('./models/Report');
const Payment = require('./models/Payment');

// ---- Utils ----
const { requireAuth, issueTokenCookie, clearTokenCookie } = require('./middleware/auth');
const { computeReport } = require('./utils/scoring');
const {
  INDUSTRIES,
  OFFICIAL_ORGANISATIONS,
  STRATEGIC_DRIVERS,
  CAPABILITY_CATALOG,
  getQuestionnaire,
  getCapability
} = require('./data/catalog');
const { fetchOrganizationIntel } = require('./utils/openai');

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Auth
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, company, role, industry } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email/password' });
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const user = await User.createSecure({ name, email, password, company, role, industry });
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: (email||'').toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await user.verifyPassword(password || '');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearTokenCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.uid);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, user: user.public() });
});

// Assessment catalog & questions
app.get('/api/assessments/catalog', (req, res) => {
  res.json({
    ok: true,
    catalog: {
      capabilities: CAPABILITY_CATALOG,
      industries: INDUSTRIES,
      organisations: OFFICIAL_ORGANISATIONS,
      strategicDrivers: STRATEGIC_DRIVERS
    }
  });
});

app.get('/api/assessments/questions', (req, res) => {
  const { stage = 'free' } = req.query;
  const safeStage = stage === 'premium' ? 'premium' : 'free';
  const questions = getQuestionnaire(safeStage);
  res.json({ ok: true, stage: safeStage, questions });
});

// Create assessment -> compute report (partial by default)
app.post('/api/assessments', requireAuth, async (req, res) => {
  try {
      const {
        stage = 'free',
        assessmentType = 'security',
        vertical: verticalRaw = 'generic',
        companySize = 'SMB',
        region = 'EMEA',
        industry = '',
        strategicDrivers = [],
      organization = {},
      companyProfile = {},
      capabilityFocus = [],
      techLandscape = {},
      personas = [],
      vendorStrategy = {},
      operatingModel = {},
      answers = {},
      premiumAnswers = {}
    } = req.body || {};

    const safeStage = stage === 'premium' ? 'premium' : 'free';
    const safeVertical = String(verticalRaw || 'generic').toLowerCase();
    const vertical = ['generic', 'saas'].includes(safeVertical) ? safeVertical : 'generic';
    const capability = getCapability(assessmentType);

    let organizationIntel = {};
    if (organization?.name) {
      organizationIntel = await fetchOrganizationIntel({
        organization: organization.name,
        assessmentType: capability.name,
        industry: industry || vertical
      });
    }

    const assessment = await Assessment.create({
      userId: req.auth.uid,
      assessmentType,
      stage: safeStage,
      vertical,
      industry,
      companySize,
      region,
      strategicDrivers,
      organization: {
        name: organization?.name || '',
        extract: organizationIntel.summary || organization?.extract || '',
        intel: organizationIntel
      },
      companyProfile,
      capabilityFocus: capabilityFocus.length ? capabilityFocus : capability.domains,
      techLandscape,
      vendorStrategy,
      operatingModel,
      personas: personas.length ? personas : capability.personas,
      answers,
      premiumAnswers: safeStage === 'premium' ? premiumAnswers : {}
    });

    const reportData = await computeReport({ assessment });
    const report = await Report.create({
      userId: req.auth.uid,
      assessmentId: assessment._id,
      ...reportData,
      paid: safeStage === 'premium'
    });

    res.json({ ok: true, assessmentId: assessment._id, reportId: report._id, stage: report.stage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/assessments/:id', requireAuth, async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, assessment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/assessments/:id/premium', requireAuth, async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!assessment) return res.status(404).json({ error: 'Not found' });

    const {
      strategicDrivers = [],
      organization = {},
      companyProfile = {},
      capabilityFocus = [],
      techLandscape = {},
      vendorStrategy = {},
      operatingModel = {},
      personas = [],
      answers = {},
      premiumAnswers = {}
    } = req.body || {};

    const targetType = nextAssessmentType || assessment.assessmentType;
    const capability = getCapability(targetType);
    assessment.assessmentType = capability.id;

    let organizationIntel = assessment.organization?.intel || {};
    if (organization?.name && organization.name !== assessment.organization?.name) {
      organizationIntel = await fetchOrganizationIntel({
        organization: organization.name,
        assessmentType: capability.name,
        industry: assessment.industry || assessment.vertical
      });
    } else if (!organization?.name) {
      organizationIntel = {};
    }

    assessment.stage = 'premium';
    assessment.strategicDrivers = strategicDrivers.length ? strategicDrivers : assessment.strategicDrivers;
    const orgName = organization?.name || '';
    assessment.organization = {
      name: orgName,
      extract: orgName ? (organizationIntel.summary || organization?.extract || assessment.organization?.extract || '') : '',
      intel: orgName ? organizationIntel : {}
    };
    assessment.companyProfile = { ...(assessment.companyProfile || {}), ...companyProfile };
    assessment.capabilityFocus = capabilityFocus.length ? capabilityFocus : (assessment.capabilityFocus || capability.domains);
    assessment.techLandscape = { ...(assessment.techLandscape || {}), ...techLandscape };
    assessment.vendorStrategy = { ...(assessment.vendorStrategy || {}), ...vendorStrategy };
    assessment.operatingModel = { ...(assessment.operatingModel || {}), ...operatingModel };
    assessment.personas = personas.length ? personas : (assessment.personas?.length ? assessment.personas : capability.personas);
    assessment.answers = { ...(assessment.answers || {}), ...answers };
    assessment.premiumAnswers = { ...(assessment.premiumAnswers || {}), ...premiumAnswers };

    await assessment.save();

    const reportData = await computeReport({ assessment });
    const report = await Report.findOneAndUpdate(
      { assessmentId: assessment._id, userId: req.auth.uid },
      { ...reportData, paid: true, assessmentId: assessment._id, userId: req.auth.uid },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, assessmentId: assessment._id, reportId: report._id, stage: report.stage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch report (partial view if not paid)
app.get('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const rep = await Report.findOne({ _id: req.params.id, userId: req.auth.uid });
    if (!rep) return res.status(404).json({ error: 'Not found' });
    const partial = {
      _id: rep._id,
      createdAt: rep.createdAt,
      vertical: rep.vertical,
      assessmentType: rep.assessmentType,
      stage: rep.stage,
      assessmentId: rep.assessmentId,
      summary: rep.summary,
      headlineScore: rep.headlineScore,
      pillarScores: rep.pillarScores,
      benchmarks: { medians: rep.benchmarks?.medians },
      recommendations: rep.recommendations.slice(0, 3),
      competitorSummary: rep.competitorSummary ? {
        percentile: rep.competitorSummary.percentile,
        narrative: rep.competitorSummary.narrative,
        median: rep.competitorSummary.median
      } : undefined,
      pillarInsights: Object.fromEntries(Object.entries(rep.pillarInsights || {}).slice(0, 1)),
      investmentOutlook: {
        savingsNarrative: rep.investmentOutlook?.savingsNarrative,
        pillarAllocations: Object.fromEntries(Object.entries(rep.investmentOutlook?.pillarAllocations || {}).slice(0, 1))
      },
      roadmap: Object.fromEntries(Object.entries(rep.roadmap || {}).slice(0, 1)),
      technologyRadar: (rep.technologyRadar || []).slice(0, 1),
      personaBriefings: (rep.personaBriefings || []).slice(0, 1),
      riskRegister: (rep.riskRegister || []).slice(0, 1),
      revenueOpportunities: (rep.revenueOpportunities || []).slice(0, 1),
      operationalPlan: Object.fromEntries(Object.entries(rep.operationalPlan || {}).slice(0, 1)),
      aiNarrative: rep.aiNarrative && rep.aiNarrative.executiveSummary ? { executiveSummary: rep.aiNarrative.executiveSummary } : {},
      paid: rep.paid,
      partial: !rep.paid
    };
    res.json({ ok: true, report: rep.paid ? rep : partial });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List latest reports for dashboard
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.auth.uid })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('_id createdAt headlineScore paid vertical');
    res.json({ ok: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mock payment to unlock
app.post('/api/payments/mock/checkout', requireAuth, async (req, res) => {
  try {
    const { reportId } = req.body || {};
    const rep = await Report.findOne({ _id: reportId, userId: req.auth.uid });
    if (!rep) return res.status(404).json({ error: 'Report not found' });
    // create payment record
    const pay = await Payment.create({
      userId: req.auth.uid,
      reportId,
      amount: 49900,
      currency: 'GBP',
      status: 'paid'
    });
    rep.paid = true;
    await rep.save();
    res.json({ ok: true, paymentId: pay._id, reportId: rep._id, assessmentId: rep.assessmentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---- Static frontend ----
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for basic navigation
app.get('*', (req, res) => {
  const p = path.join(PUBLIC_DIR, 'index.html');
  res.sendFile(p);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 Agama Technologies backend running on port', port);
});
