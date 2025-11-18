require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { WorkOS } = require('@workos-inc/node');

const { requireAuth, issueTokenCookie, clearTokenCookie } = require('./middleware/auth');
const { validateBody } = require('./middleware/validation');
const User = require('./models/User');
const ProcurementVendor = require('./models/ProcurementVendor');
const RevenueAccount = require('./models/RevenueAccount');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const workosClient = process.env.WORKOS_API_KEY ? new WorkOS(process.env.WORKOS_API_KEY) : null;
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
const WORKOS_REDIRECT_URI =
  process.env.WORKOS_REDIRECT_URI || `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/api/auth/workos/callback`;
const WORKOS_SUCCESS_REDIRECT = process.env.WORKOS_SUCCESS_REDIRECT || process.env.RENDER_EXTERNAL_URL || '/';

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
if (isProduction) {
  app.use(helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true }));
}
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);
const corsInstance = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('CORS_NOT_ALLOWED'));
  },
  credentials: true
});
app.use((req, res, next) => {
  corsInstance(req, res, err => {
    if (err && err.message === 'CORS_NOT_ALLOWED') {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (err) return next(err);
    return next();
  });
});

app.use(morgan('dev'));

const limiterDefaults = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false
};
const authLimiter = rateLimit({ ...limiterDefaults, max: 60 });
app.use('/api/auth', authLimiter);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agama_tech';
mongoose.set('strictQuery', true);
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PLATFORM_DEFINITIONS = [
  {
    id: 'valuesphere',
    name: 'ValueSphere Consulting',
    strapline: 'Business value consulting reinvented for modern operators.',
    summary:
      'Deliver personal and enterprise-grade value assessments that translate strategy into measurable commercial outcomes.',
    licenseNotes: {
      personal: 'Personal ValueSphere Navigator assessments.',
      business: 'Navigator assessments plus Catalyst advisory squads.'
    }
  },
  {
    id: 'procurepath',
    name: 'ProcurePath Control Tower',
    strapline: 'The procurement nerve centre for orchestrating vendors, contracts, and governance.',
    summary:
      'Give procurement organisations a unified workspace for vendor intelligence, contract health, and negotiation playbooks.',
    requiresBusinessLicense: true,
    licenseNotes: {
      business: 'Business license unlocks full ProcurePath orchestration.'
    }
  },
  {
    id: 'revenueforge',
    name: 'RevenueForge AI Studio',
    strapline: 'AI-guided commercial execution from discovery through renewals.',
    summary:
      'Operationalise sales plays, qualification flows, and AI copilots that manage every lead to close.',
    requiresBusinessLicense: true,
    licenseNotes: {
      business: 'Business license unlocks collaborative AI sales workspaces.'
    }
  }
];

const PLATFORM_IDS = new Set(PLATFORM_DEFINITIONS.map(platform => platform.id));
const PERSONAL_ALLOWED_PLATFORMS = new Set(['valuesphere']);
const LICENSE_OPTIONS = ['personal', 'business'];

function resolveWorkOSSuccessRedirect(req) {
  const target = WORKOS_SUCCESS_REDIRECT || '/';
  if (/^https?:\/\//i.test(target)) return target;

  const origin = process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
  if (target.startsWith('/')) {
    return `${origin}${target}`;
  }
  return `${origin}/${target}`;
}

function normalisePlatformAccess(licenseTier, requested) {
  if (!LICENSE_OPTIONS.includes(licenseTier)) {
    return { error: 'Unknown license tier.' };
  }
  const selections = Array.isArray(requested)
    ? Array.from(new Set(requested.map(value => String(value))))
    : [];

  if (licenseTier === 'personal') {
    const disallowed = selections.filter(id => id && !PERSONAL_ALLOWED_PLATFORMS.has(id));
    if (disallowed.length > 0) {
      return { error: 'Personal licenses only include ValueSphere Consulting.' };
    }
    return { platformAccess: ['valuesphere'] };
  }

  const filtered = selections.filter(id => PLATFORM_IDS.has(id));
  if (filtered.length === 0) {
    return { error: 'Select at least one platform for your business license.' };
  }
  return { platformAccess: filtered };
}

function assertProcurePathAccess(user) {
  const hasProcurePath = Array.isArray(user.platformAccess) && user.platformAccess.includes('procurepath');
  if (user.licenseTier !== 'business' || !hasProcurePath) {
    return { error: 'ProcurePath Control Tower requires a business license with ProcurePath enabled.' };
  }
  return { ok: true };
}

function assertRevenueForgeAccess(user) {
  const hasRevenueForge = Array.isArray(user.platformAccess) && user.platformAccess.includes('revenueforge');
  if (user.licenseTier !== 'business' || !hasRevenueForge) {
    return { error: 'RevenueForge AI Studio requires a business license with RevenueForge enabled.' };
  }
  return { ok: true };
}

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  licenseTier: z.enum(LICENSE_OPTIONS),
  platformAccess: z.array(z.string()).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const profileUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  licenseTier: z.enum(LICENSE_OPTIONS).optional(),
  platformAccess: z.array(z.string()).optional()
});

const procurementVendorSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().max(160).optional(),
  tier: z.enum(['strategic', 'preferred', 'tactical', 'specialist']).optional(),
  businessOwner: z.string().trim().max(160).optional(),
  relationshipManager: z.string().trim().max(160).optional(),
  annualSpend: z.coerce.number().min(0).max(1_000_000_000).optional(),
  renewalDate: z.coerce.date().optional(),
  healthScore: z.coerce.number().min(0).max(100).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['active', 'watchlist', 'sunset']).optional(),
  notes: z.string().trim().max(2000).optional()
});

const procurementObjectiveSchema = z.object({
  title: z.string().trim().min(4).max(240),
  owner: z.string().trim().max(160).optional(),
  targetMetric: z.string().trim().max(200).optional(),
  targetValue: z.coerce.number().optional(),
  unit: z.string().trim().max(40).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(['on-track', 'at-risk', 'blocked', 'completed']).optional(),
  notes: z.string().trim().max(1200).optional()
});

const procurementTouchpointSchema = z.object({
  type: z.string().trim().max(120).optional(),
  occurredOn: z.coerce.date().optional(),
  summary: z.string().trim().min(4).max(800),
  followUp: z.string().trim().max(400).optional(),
  sentiment: z.string().trim().max(120).optional()
});

const revenueAccountSchema = z.object({
  name: z.string().trim().min(2).max(200),
  headcount: z.coerce.number().int().positive().max(1_000_000).optional(),
  ownership: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(160).optional(),
  region: z.string().trim().max(160).optional(),
  website: z.string().trim().url().optional(),
  description: z.string().trim().max(2000).optional(),
  revenueRange: z.string().trim().max(160).optional(),
  isCustomer: z.coerce.boolean().optional()
});

const revenueOpportunitySchema = z.object({
  name: z.string().trim().min(2).max(240),
  value: z.coerce.number().min(0).max(1_000_000_000).optional(),
  stage: z.string().trim().max(160).optional(),
  owner: z.string().trim().max(160).optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
  closeDate: z.coerce.date().optional(),
  summary: z.string().trim().max(4000).optional()
});

const revenueQualificationSchema = z.object({
  framework: z.string().trim().max(160).optional(),
  score: z.coerce.number().min(0).max(100).optional(),
  champion: z.string().trim().max(160).optional(),
  blockers: z.string().trim().max(800).optional(),
  notes: z.string().trim().max(2000).optional()
});

const riskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  severity: z.string().trim().max(80).optional(),
  impact: z.string().trim().max(400).optional(),
  mitigation: z.string().trim().max(400).optional(),
  owner: z.string().trim().max(160).optional()
});

const timelineSchema = z.object({
  milestone: z.string().trim().min(2).max(240),
  targetDate: z.coerce.date().optional(),
  risk: z.string().trim().max(240).optional()
});

const personaSchema = z.object({
  name: z.string().trim().min(2).max(200),
  role: z.string().trim().max(200).optional(),
  influence: z.string().trim().max(160).optional(),
  goals: z.string().trim().max(400).optional(),
  stance: z.string().trim().max(200).optional(),
  contact: z.string().trim().max(200).optional()
});

const requirementSchema = z.object({
  requirement: z.string().trim().min(2).max(320),
  priority: z.string().trim().max(120).optional(),
  owner: z.string().trim().max(160).optional(),
  status: z.string().trim().max(160).optional()
});

const pocSchema = z.object({
  criterion: z.string().trim().min(2).max(320),
  metric: z.string().trim().max(200).optional(),
  status: z.string().trim().max(160).optional(),
  owner: z.string().trim().max(160).optional()
});

const linkSchema = z.object({
  label: z.string().trim().min(2).max(200),
  url: z.string().trim().url(),
  description: z.string().trim().max(320).optional()
});

const collateralSchema = z.object({
  title: z.string().trim().min(2).max(240),
  type: z.string().trim().max(160).optional(),
  url: z.string().trim().url()
});

const revenueCollaborationSchema = z.object({
  risks: z.array(riskSchema).optional(),
  qualification: revenueQualificationSchema.optional(),
  timelines: z.array(timelineSchema).optional(),
  personas: z.array(personaSchema).optional(),
  architecture: z
    .object({
      currentState: z.string().trim().max(2000).optional(),
      proposedState: z.string().trim().max(2000).optional(),
      integrations: z.string().trim().max(2000).optional()
    })
    .optional(),
  technicalRequirements: z.array(requirementSchema).optional(),
  pocSuccess: z.array(pocSchema).optional(),
  customLinks: z.array(linkSchema).optional(),
  collateral: z.array(collateralSchema).optional(),
  summary: z.string().trim().max(2000).optional()
});

const opportunityUpdateSchema = revenueCollaborationSchema.merge(revenueOpportunitySchema.partial());

const meetingNoteSchema = z.object({
  title: z.string().trim().max(240).optional(),
  occurredAt: z.coerce.date(),
  notes: z.string().trim().max(6000).optional(),
  followUps: z.string().trim().max(3000).optional(),
  internalAttendees: z.array(z.string().trim().max(160)).optional(),
  customerAttendees: z.array(z.string().trim().max(160)).optional(),
  transcript: z.string().trim().max(12_000).optional(),
  primaryRep: z.string().trim().max(160).optional()
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/platforms', (req, res) => {
  res.json({ ok: true, platforms: PLATFORM_DEFINITIONS });
});

app.post('/api/auth/signup', validateBody(signupSchema), async (req, res) => {
  try {
    const { name, email, password, company, role, industry, licenseTier, platformAccess: requested } = req.validatedBody;
    const normalised = normalisePlatformAccess(licenseTier, requested);
    if (normalised.error) {
      return res.status(400).json({ error: normalised.error });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.createSecure({
      name,
      email,
      password,
      company,
      role,
      industry,
      licenseTier,
      platformAccess: normalised.platformAccess
    });

    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/workos/callback', async (req, res) => {
  if (!workosClient || !WORKOS_CLIENT_ID) {
    return res.status(503).json({ error: 'WorkOS is not configured' });
  }

  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });

  try {
    const authentication = await workosClient.userManagement.authenticateWithCode({
      code,
      clientId: WORKOS_CLIENT_ID,
      redirectUri: WORKOS_REDIRECT_URI
    });

    const profile = authentication?.user || authentication?.profile;
    if (!profile) {
      throw new Error('Missing WorkOS user profile');
    }

    const user = await User.findOrCreateFromWorkOSProfile(profile);
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    const redirectUrl = resolveWorkOSSuccessRedirect(req);

    if (req.accepts(['json']) && !req.accepts(['html'])) {
      return res.json({ ok: true, user: user.public(), token, redirect: redirectUrl });
    }

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('WorkOS callback error', err);
    const redirectUrl = resolveWorkOSSuccessRedirect(req);
    if (req.accepts(['json']) && !req.accepts(['html'])) {
      return res.status(500).json({ error: 'Unable to complete WorkOS sign-in' });
    }

    return res.redirect(`${redirectUrl}?error=workos_login_failed`);
  }
});

app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validatedBody;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Password login is disabled for this account. Use WorkOS to sign in.' });
    }
    const valid = await user.verifyPassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = issueTokenCookie(res, { uid: user._id.toString() });
    res.json({ ok: true, user: user.public(), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  clearTokenCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, user: user.public(), platforms: PLATFORM_DEFINITIONS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/auth/me', requireAuth, validateBody(profileUpdateSchema), async (req, res) => {
  try {
    const user = await User.findById(req.auth.uid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const payload = req.validatedBody;
    const nextLicenseTier = payload.licenseTier || user.licenseTier;
    const desiredPlatforms = payload.platformAccess || user.platformAccess;
    const normalised = normalisePlatformAccess(nextLicenseTier, desiredPlatforms);
    if (normalised.error) {
      return res.status(400).json({ error: normalised.error });
    }

    ['name', 'company', 'role', 'industry'].forEach(field => {
      if (payload[field] !== undefined) {
        user[field] = String(payload[field]).trim();
      }
    });

    user.licenseTier = nextLicenseTier;
    user.platformAccess = normalised.platformAccess;
    await user.save();
    res.json({ ok: true, user: user.public(), platforms: PLATFORM_DEFINITIONS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update profile' });
  }
});

app.delete('/api/auth/me', requireAuth, async (req, res) => {
  try {
    await User.deleteOne({ _id: req.auth.uid });
    clearTokenCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete profile' });
  }
});

async function loadProcurePathUser(req, res) {
  const user = await User.findById(req.auth.uid);
  if (!user) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  const access = assertProcurePathAccess(user);
  if (access.error) {
    res.status(403).json({ error: access.error });
    return null;
  }

  return user;
}

async function loadRevenueForgeUser(req, res) {
  const user = await User.findById(req.auth.uid);
  if (!user) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  const access = assertRevenueForgeAccess(user);
  if (access.error) {
    res.status(403).json({ error: access.error });
    return null;
  }

  return user;
}

function calculateRevenueStats(account) {
  const opportunities = account.opportunities || [];
  const totalValue = opportunities.reduce((acc, opp) => acc + (opp.value || 0), 0);
  const totalMeetings = opportunities.reduce((acc, opp) => acc + (opp.meetingNotes?.length || 0), 0);
  const totalNotes = opportunities.reduce((acc, opp) => {
    const collaborationNotes = [
      opp.summary,
      opp.qualification?.notes,
      opp.qualification?.blockers,
      opp.qualification?.framework,
      opp.architecture?.currentState,
      opp.architecture?.proposedState
    ].filter(Boolean);
    return acc + collaborationNotes.length;
  }, 0);

  return {
    opportunityCount: opportunities.length,
    totalValue,
    meetingCount: totalMeetings,
    noteCount: totalNotes
  };
}

app.get('/api/procurepath/overview', requireAuth, async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;
    const vendors = await ProcurementVendor.find({ userId: user._id }).lean();

    const totalObjectives = vendors.reduce((acc, vendor) => acc + (vendor.objectives?.length || 0), 0);
    const atRiskVendors = vendors.filter(vendor => vendor.riskLevel === 'high' || vendor.status === 'watchlist').length;
    const upcomingRenewals = vendors.filter(vendor => {
      if (!vendor.renewalDate) return false;
      const diff = new Date(vendor.renewalDate).getTime() - Date.now();
      return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
    }).length;

    res.json({
      ok: true,
      overview: {
        totalVendors: vendors.length,
        totalObjectives,
        atRiskVendors,
        upcomingRenewals
      },
      vendors
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load ProcurePath overview' });
  }
});

app.get('/api/procurepath/vendors', requireAuth, async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;
    const vendors = await ProcurementVendor.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();
    res.json({ ok: true, vendors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch vendors' });
  }
});

app.post('/api/procurepath/vendors', requireAuth, validateBody(procurementVendorSchema), async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;
    const vendor = await ProcurementVendor.create({ ...req.validatedBody, userId: user._id });
    res.status(201).json({ ok: true, vendor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create vendor' });
  }
});

app.put('/api/procurepath/vendors/:id', requireAuth, validateBody(procurementVendorSchema.partial()), async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;
    const vendor = await ProcurementVendor.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      { $set: req.validatedBody },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json({ ok: true, vendor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update vendor' });
  }
});

app.post(
  '/api/procurepath/vendors/:id/objectives',
  requireAuth,
  validateBody(procurementObjectiveSchema),
  async (req, res) => {
    try {
      const user = await loadProcurePathUser(req, res);
      if (!user) return;

      const vendor = await ProcurementVendor.findOne({ _id: req.params.id, userId: user._id });
      if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

      vendor.objectives.push(req.validatedBody);
      await vendor.save();
      res.status(201).json({ ok: true, vendor });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to add objective' });
    }
  }
);

app.post(
  '/api/procurepath/vendors/:id/touchpoints',
  requireAuth,
  validateBody(procurementTouchpointSchema),
  async (req, res) => {
    try {
      const user = await loadProcurePathUser(req, res);
      if (!user) return;

      const vendor = await ProcurementVendor.findOne({ _id: req.params.id, userId: user._id });
      if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

      vendor.touchpoints.push(req.validatedBody);
      await vendor.save();
      res.status(201).json({ ok: true, vendor });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to add touchpoint' });
    }
  }
);

app.post('/api/procurepath/ai/playbook', requireAuth, async (req, res) => {
  try {
    const user = await loadProcurePathUser(req, res);
    if (!user) return;

    if (!OPENAI_API_KEY) {
      return res
        .status(400)
        .json({ error: 'OpenAI API key missing. Add OPENAI_API_KEY to generate AI playbooks.' });
    }

    const { vendorId, goal } = req.body || {};
    if (!vendorId || !goal) {
      return res.status(400).json({ error: 'Provide vendorId and goal to generate a playbook.' });
    }

    const vendor = await ProcurementVendor.findOne({ _id: vendorId, userId: user._id });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const latestObjectives = (vendor.objectives || []).slice(-3);
    const objectiveSummary = latestObjectives
      .map(obj => `${obj.title} (${obj.status || 'on-track'}) - ${obj.targetMetric || 'Outcome focus'}`)
      .join('; ');

    const touchpointSummary = (vendor.touchpoints || [])
      .slice(-2)
      .map(tp => `${tp.type || 'Touchpoint'}: ${tp.summary}`)
      .join(' | ');

    const prompt = [
      'You are a procurement strategist building a vendor relationship playbook.',
      `Vendor: ${vendor.name} (${vendor.category || 'uncategorised'}). Tier: ${vendor.tier}. Risk: ${vendor.riskLevel}. Health: ${
        vendor.healthScore || 'n/a'
      }. Annual spend: ${vendor.annualSpend || 0}.`,
      `Objectives: ${objectiveSummary || 'No objectives logged yet.'}`,
      `Recent touchpoints: ${touchpointSummary || 'No recent activity recorded.'}`,
      `Goal: ${goal}.`,
      'Return a concise plan with 3-5 actions, KPIs to monitor, and negotiation guardrails.'
    ].join('\n');

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced procurement leader who writes crisp action plans.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 600
      })
    });

    if (!completion.ok) {
      const error = await completion.text();
      return res.status(500).json({ error: 'OpenAI request failed', details: error });
    }

    const data = await completion.json();
    const message = data.choices?.[0]?.message?.content?.trim();
    res.json({ ok: true, playbook: message || 'No plan generated. Try again with more context.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to generate playbook' });
  }
});

app.get('/api/revenueforge/accounts', requireAuth, async (req, res) => {
  try {
    const user = await loadRevenueForgeUser(req, res);
    if (!user) return;
    const accounts = await RevenueAccount.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();
    const enriched = accounts.map(account => ({ ...account, stats: calculateRevenueStats(account) }));
    res.json({ ok: true, accounts: enriched });
  } catch (err) {
    console.error('RevenueForge account listing failed', err);
    res.status(500).json({ error: 'Unable to load RevenueForge accounts' });
  }
});

app.post('/api/revenueforge/accounts', requireAuth, validateBody(revenueAccountSchema), async (req, res) => {
  try {
    const user = await loadRevenueForgeUser(req, res);
    if (!user) return;
    const account = await RevenueAccount.create({ ...req.validatedBody, userId: user._id });
    res.status(201).json({ ok: true, account, stats: calculateRevenueStats(account) });
  } catch (err) {
    console.error('RevenueForge account create failed', err);
    res.status(500).json({ error: 'Unable to create account' });
  }
});

app.get('/api/revenueforge/accounts/:id', requireAuth, async (req, res) => {
  try {
    const user = await loadRevenueForgeUser(req, res);
    if (!user) return;
    const account = await RevenueAccount.findOne({ _id: req.params.id, userId: user._id });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json({ ok: true, account, stats: calculateRevenueStats(account) });
  } catch (err) {
    console.error('RevenueForge account fetch failed', err);
    res.status(500).json({ error: 'Unable to load account' });
  }
});

app.post(
  '/api/revenueforge/accounts/:id/opportunities',
  requireAuth,
  validateBody(revenueOpportunitySchema),
  async (req, res) => {
    try {
      const user = await loadRevenueForgeUser(req, res);
      if (!user) return;
      const account = await RevenueAccount.findOne({ _id: req.params.id, userId: user._id });
      if (!account) return res.status(404).json({ error: 'Account not found' });
      account.opportunities.push(req.validatedBody);
      await account.save();
      const opportunity = account.opportunities[account.opportunities.length - 1];
      res.status(201).json({ ok: true, opportunity, account, stats: calculateRevenueStats(account) });
    } catch (err) {
      console.error('RevenueForge opportunity create failed', err);
      res.status(500).json({ error: 'Unable to create opportunity' });
    }
  }
);

app.put(
  '/api/revenueforge/accounts/:accountId/opportunities/:opportunityId',
  requireAuth,
  validateBody(opportunityUpdateSchema),
  async (req, res) => {
    try {
      const user = await loadRevenueForgeUser(req, res);
      if (!user) return;
      const account = await RevenueAccount.findOne({ _id: req.params.accountId, userId: user._id });
      if (!account) return res.status(404).json({ error: 'Account not found' });
      const opportunity = account.opportunities.id(req.params.opportunityId);
      if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

      Object.entries(req.validatedBody).forEach(([key, value]) => {
        opportunity[key] = value;
      });

      await account.save();
      res.json({ ok: true, opportunity, account, stats: calculateRevenueStats(account) });
    } catch (err) {
      console.error('RevenueForge opportunity update failed', err);
      res.status(500).json({ error: 'Unable to update opportunity' });
    }
  }
);

app.post(
  '/api/revenueforge/opportunities/:opportunityId/meetings',
  requireAuth,
  validateBody(meetingNoteSchema),
  async (req, res) => {
    try {
      const user = await loadRevenueForgeUser(req, res);
      if (!user) return;
      const account = await RevenueAccount.findOne({ userId: user._id, 'opportunities._id': req.params.opportunityId });
      if (!account) return res.status(404).json({ error: 'Opportunity not found' });
      const opportunity = account.opportunities.id(req.params.opportunityId);
      if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

      const meetingPayload = {
        title: req.validatedBody.title || 'Customer touchpoint',
        occurredAt: req.validatedBody.occurredAt,
        notes: req.validatedBody.notes,
        followUps: req.validatedBody.followUps,
        internalAttendees: req.validatedBody.internalAttendees || [],
        customerAttendees: req.validatedBody.customerAttendees || [],
        transcriptSource: req.validatedBody.transcript ? 'provided' : undefined
      };

      if (req.validatedBody.transcript && OPENAI_API_KEY) {
        try {
          const attendees = [
            req.validatedBody.primaryRep ? `Primary seller: ${req.validatedBody.primaryRep}.` : null,
            meetingPayload.internalAttendees.length
              ? `Internal: ${meetingPayload.internalAttendees.join(', ')}.`
              : null,
            meetingPayload.customerAttendees.length
              ? `Customer: ${meetingPayload.customerAttendees.join(', ')}.`
              : null
          ]
            .filter(Boolean)
            .join(' ');

          const prompt = [
            'You are a revenue strategist producing crisp meeting insights.',
            attendees || 'Meeting attendees were not provided.',
            'Transcript:',
            req.validatedBody.transcript,
            'Return bullet insights for notes, actions, next steps, and sentiment. Keep it concise.'
          ].join('\n');

          const completion = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are an enterprise account executive assistant.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.3,
              max_tokens: 700
            })
          });

          if (completion.ok) {
            const data = await completion.json();
            const aiContent = data.choices?.[0]?.message?.content;
            meetingPayload.aiSummary = aiContent || 'AI summary unavailable';
            meetingPayload.aiActions = 'AI generated insights';
          } else {
            const details = await completion.text();
            console.error('OpenAI meeting summary failed', details);
          }
        } catch (aiErr) {
          console.error('OpenAI meeting summary errored', aiErr);
        }
      }

      opportunity.meetingNotes.push(meetingPayload);
      await account.save();
      const meeting = opportunity.meetingNotes[opportunity.meetingNotes.length - 1];
      res.status(201).json({ ok: true, meeting, opportunity, account, stats: calculateRevenueStats(account) });
    } catch (err) {
      console.error('RevenueForge meeting capture failed', err);
      res.status(500).json({ error: 'Unable to capture meeting notes' });
    }
  }
);

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

app.get('*', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, 'index.html');
  res.sendFile(filePath);
});

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log('🚀 Agama Technologies backend running on port', port);
  });
}

module.exports = app;
