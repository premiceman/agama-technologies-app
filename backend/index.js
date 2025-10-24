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

// Questions
app.get('/api/assessments/questions', (req, res) => {
  const { vertical = 'generic' } = req.query;
  try {
    const questions = require(path.join(__dirname, 'data', 'questions', `${vertical}.json`));
    res.json({ ok: true, vertical, questions });
  } catch {
    const questions = require(path.join(__dirname, 'data', 'questions', `generic.json`));
    res.json({ ok: true, vertical: 'generic', questions });
  }
});

// Create assessment -> compute report (partial by default)
app.post('/api/assessments', requireAuth, async (req, res) => {
  try {
    const { vertical: verticalRaw='generic', companySize='SMB', region='EMEA', answers={} } = req.body || {};
    const safeVertical = String(verticalRaw || 'generic').toLowerCase();
    const vertical = ['generic', 'saas'].includes(safeVertical) ? safeVertical : 'generic';
    const assessment = await Assessment.create({
      userId: req.auth.uid,
      vertical, companySize, region, answers
    });
    const reportData = await computeReport({ assessment });
    const report = await Report.create({
      userId: req.auth.uid,
      assessmentId: assessment._id,
      ...reportData,
      paid: false
    });
    res.json({ ok: true, assessmentId: assessment._id, reportId: report._id });
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
    res.json({ ok: true, paymentId: pay._id, reportId: rep._id });
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
